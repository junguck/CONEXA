import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from conexa_ai_worker.encoder import encode_profile
from conexa_ai_worker.events import DATE_COMPLETED, EMBEDDING_COMPUTED, DatingWorker
from conexa_ai_worker.idempotency import InMemoryIdempotencyStore
from conexa_ai_worker.runtime import InMemoryEventSource, WorkerRuntime

SERVICE_DIR = Path(__file__).resolve().parents[1]
FIXTURE = SERVICE_DIR / "tests" / "fixtures" / "dating.embedding_requested.v1.json"
FIXED_TIME = datetime(2026, 10, 26, 9, 30, tzinfo=timezone.utc)


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def new_worker():
    ids = iter(f"00000000-0000-4000-8000-{index:012d}" for index in range(1, 20))
    return DatingWorker(
        store=InMemoryIdempotencyStore(),
        clock=lambda: FIXED_TIME,
        event_id_factory=lambda: next(ids),
    )


def empty_date_event():
    return {
        "id": "b4f0c0de-0000-4000-8000-000000000001",
        "type": DATE_COMPLETED,
        "version": 1,
        "occurred_at": "2026-10-26T09:00:00Z",
        "producer": "dating",
        "payload": {
            "date_id": "d4f0c0de-0000-4000-8000-000000000002",
            "updates": [],
        },
    }


class RecordingSink:
    def __init__(self):
        self.batches = []

    def publish(self, events):
        self.batches.append(list(events))


class ExplodingSink:
    def publish(self, events):
        raise RuntimeError("bus unavailable")


class RecordingDeadLetters:
    def __init__(self):
        self.records = []

    def record(self, event, reason):
        self.records.append((event, reason))


class RuntimeTests(unittest.TestCase):
    def _runtime(self, source, sink=None, dead_letters=None):
        return WorkerRuntime(
            source,
            sink or RecordingSink(),
            worker=new_worker(),
            dead_letters=dead_letters,
        )

    def test_valid_event_is_published_then_acknowledged(self):
        source = InMemoryEventSource()
        event = load_fixture()
        source.push(event)
        sink = RecordingSink()

        processed = self._runtime(source, sink).run()

        self.assertEqual(processed, 1)
        self.assertEqual(source.acked, [event])
        self.assertEqual(source.rejected, [])
        self.assertEqual(len(sink.batches), 1)
        self.assertEqual(sink.batches[0][0]["type"], EMBEDDING_COMPUTED)

    def test_invalid_event_is_rejected_recorded_and_not_published(self):
        source = InMemoryEventSource()
        source.push({"id": "bad", "type": "dating.embedding_requested"})
        sink = RecordingSink()
        dead_letters = RecordingDeadLetters()

        processed = self._runtime(source, sink, dead_letters).run()

        self.assertEqual(processed, 1)
        self.assertEqual(source.acked, [])
        self.assertEqual(len(source.rejected), 1)
        self.assertIn("missing envelope fields", source.rejected[0][1])
        self.assertEqual(len(dead_letters.records), 1)
        self.assertEqual(sink.batches, [])

    def test_loop_continues_after_an_invalid_event(self):
        source = InMemoryEventSource()
        valid = load_fixture()
        source.push({"id": "bad", "type": "dating.embedding_requested"})
        source.push(valid)
        sink = RecordingSink()

        processed = self._runtime(source, sink).run()

        self.assertEqual(processed, 2)
        self.assertEqual(len(source.rejected), 1)
        self.assertEqual(source.acked, [valid])
        self.assertEqual(len(sink.batches), 1)

    def test_empty_output_is_acknowledged_without_publishing(self):
        source = InMemoryEventSource()
        source.push(empty_date_event())
        sink = RecordingSink()
        runtime = self._runtime(source, sink)

        self.assertTrue(runtime.run_once())

        self.assertEqual(len(source.acked), 1)
        self.assertEqual(sink.batches, [])

    def test_sink_failure_leaves_the_event_unacknowledged(self):
        source = InMemoryEventSource()
        source.push(load_fixture())

        with self.assertRaises(RuntimeError):
            self._runtime(source, ExplodingSink()).run_once()

        self.assertEqual(source.acked, [])
        self.assertEqual(source.rejected, [])

    def test_max_events_stops_the_loop_and_keeps_the_rest(self):
        source = InMemoryEventSource()
        first = load_fixture()
        second = dict(first, id="6f1c5f2e-3f0e-4a5a-9b4a-2f2f0c1d9a12")
        source.push(first)
        source.push(second)
        sink = RecordingSink()

        processed = self._runtime(source, sink).run(max_events=1)

        self.assertEqual(processed, 1)
        self.assertEqual(len(source), 1)
        self.assertEqual(source.acked, [first])

    def test_empty_source_processes_nothing(self):
        self.assertEqual(self._runtime(InMemoryEventSource()).run(), 0)

    def test_negative_max_events_is_refused(self):
        with self.assertRaises(ValueError):
            self._runtime(InMemoryEventSource()).run(max_events=-1)

    def test_redelivered_event_is_replayed_from_the_idempotency_store(self):
        source = InMemoryEventSource()
        event = load_fixture()
        source.push(event)
        source.push(event)
        sink = RecordingSink()
        runtime = self._runtime(source, sink)

        with patch("conexa_ai_worker.events.encode_profile", wraps=encode_profile) as encoder:
            processed = runtime.run()

        self.assertEqual(processed, 2)
        self.assertEqual(encoder.call_count, 1)
        self.assertEqual(len(source.acked), 2)
        self.assertEqual(len(sink.batches), 2)
        self.assertEqual(sink.batches[0][0]["id"], sink.batches[1][0]["id"])


if __name__ == "__main__":
    unittest.main()
