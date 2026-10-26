import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from conexa_ai_worker.encoder import encode_profile
from conexa_ai_worker.events import DatingWorker
from conexa_ai_worker.idempotency import (
    IdempotencyError,
    RedisIdempotencyStore,
)

SERVICE_DIR = Path(__file__).resolve().parents[1]
FIXTURE = SERVICE_DIR / "tests" / "fixtures" / "dating.embedding_requested.v1.json"
FIXED_TIME = datetime(2026, 10, 26, 9, 30, tzinfo=timezone.utc)


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class FakeRedis:
    """Structural stand-in for ``redis.Redis`` (GET / SET EX only)."""

    def __init__(self) -> None:
        self.now = 0.0
        self.values: dict[str, tuple[str | bytes, float | None]] = {}
        self.set_calls: list[tuple[str, str, int | None]] = []
        self.get_calls: list[str] = []

    def get(self, name):
        self.get_calls.append(name)
        entry = self.values.get(name)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at is not None and expires_at <= self.now:
            del self.values[name]
            return None
        return value

    def set(self, name, value, ex=None):
        self.set_calls.append((name, value, ex))
        self.values[name] = (value, None if ex is None else self.now + ex)
        return True


class RedisIdempotencyStoreTests(unittest.TestCase):
    def setUp(self):
        self.redis = FakeRedis()
        self.store = RedisIdempotencyStore(self.redis, ttl_seconds=60, prefix="test:")

    def test_round_trip_namespaces_key_and_sets_ttl(self):
        payload = [{"id": "event-1", "payload": {"vectors": {}}}]

        self.store.put("dating.embedding_requested:abc", payload)

        name, raw, ex = self.redis.set_calls[-1]
        self.assertEqual(name, "test:dating.embedding_requested:abc")
        self.assertEqual(ex, 60)
        self.assertEqual(json.loads(raw), payload)
        self.assertEqual(self.store.get("dating.embedding_requested:abc"), payload)

    def test_missing_key_returns_none(self):
        self.assertIsNone(self.store.get("date.completed:missing"))

    def test_bytes_payload_is_decoded(self):
        raw = json.dumps([{"id": "event-1"}]).encode("utf-8")
        self.redis.values["test:date.completed:abc"] = (raw, None)

        self.assertEqual(self.store.get("date.completed:abc"), [{"id": "event-1"}])

    def test_expired_key_returns_none(self):
        self.store.put("date.completed:abc", [{"id": "event-1"}])

        self.redis.now = 61.0

        self.assertIsNone(self.store.get("date.completed:abc"))

    def test_corrupt_payload_is_refused(self):
        for raw in ("{not json", "{}", "[1]", b"\xff"):
            self.redis.values["test:date.completed:abc"] = (raw, None)
            with self.subTest(raw=raw), self.assertRaises(IdempotencyError):
                self.store.get("date.completed:abc")

    def test_unserialisable_result_is_refused_before_writing(self):
        with self.assertRaises(IdempotencyError):
            self.store.put("date.completed:abc", [{"id": object()}])

        self.assertEqual(self.redis.set_calls, [])

    def test_ttl_prefix_and_key_are_validated(self):
        with self.assertRaises(ValueError):
            RedisIdempotencyStore(self.redis, ttl_seconds=0)
        with self.assertRaises(ValueError):
            RedisIdempotencyStore(self.redis, prefix="")
        with self.assertRaises(ValueError):
            self.store.get("")
        with self.assertRaises(ValueError):
            self.store.get("   ")

    def test_worker_replays_from_redis_without_recomputing(self):
        ids = iter(f"00000000-0000-4000-8000-{index:012d}" for index in range(1, 4))
        worker = DatingWorker(
            store=self.store,
            clock=lambda: FIXED_TIME,
            event_id_factory=lambda: next(ids),
        )
        event = load_fixture()

        with patch("conexa_ai_worker.events.encode_profile", wraps=encode_profile) as encoder:
            first = worker.handle(event)
            second = worker.handle(event)

        self.assertEqual(first, second)
        self.assertEqual(encoder.call_count, 1)
        self.assertEqual(self.redis.get_calls, [
            "test:dating.embedding_requested:6f1c5f2e-3f0e-4a5a-9b4a-2f2f0c1d9a11",
            "test:dating.embedding_requested:6f1c5f2e-3f0e-4a5a-9b4a-2f2f0c1d9a11",
        ])


if __name__ == "__main__":
    unittest.main()
