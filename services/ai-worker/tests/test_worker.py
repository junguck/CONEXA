import json
import math
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from conexa_ai_worker.encoder import BLOCKS, DIMENSION, encode_profile
from conexa_ai_worker.events import (
    DATE_COMPLETED,
    EMBEDDING_COMPUTED,
    VECTORS_UPDATED,
    DatingWorker,
    InvalidEvent,
)
from conexa_ai_worker.idempotency import InMemoryIdempotencyStore

SERVICE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVICE_DIR.parents[1]
CONTRACTS_DIR = REPO_ROOT / "packages" / "events" / "src" / "ai"
FIXTURE = SERVICE_DIR / "tests" / "fixtures" / "dating.embedding_requested.v1.json"
FIXED_TIME = datetime(2026, 10, 26, 9, 30, tzinfo=timezone.utc)


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def new_worker():
    ids = iter(f"00000000-0000-4000-8000-{index:012d}" for index in range(1, 10))
    return DatingWorker(
        store=InMemoryIdempotencyStore(),
        clock=lambda: FIXED_TIME,
        event_id_factory=lambda: next(ids),
    )


def check_schema(testcase, value, schema, root):
    if "$ref" in schema:
        name = schema["$ref"].rsplit("/", 1)[-1]
        return check_schema(testcase, value, root["$defs"][name], root)
    if "const" in schema:
        testcase.assertEqual(value, schema["const"])
    expected_type = schema.get("type")
    if expected_type == "object":
        testcase.assertIsInstance(value, dict)
        for required in schema.get("required", []):
            testcase.assertIn(required, value)
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            testcase.assertLessEqual(set(value), set(properties))
        for key, child in properties.items():
            if key in value:
                check_schema(testcase, value[key], child, root)
    elif expected_type == "array":
        testcase.assertIsInstance(value, list)
        testcase.assertGreaterEqual(len(value), schema.get("minItems", 0))
        testcase.assertLessEqual(len(value), schema.get("maxItems", len(value)))
        if "items" in schema:
            for item in value:
                check_schema(testcase, item, schema["items"], root)
    elif expected_type == "string":
        testcase.assertIsInstance(value, str)
        testcase.assertGreaterEqual(len(value), schema.get("minLength", 0))
    elif expected_type == "integer":
        testcase.assertIsInstance(value, int)
        testcase.assertNotIsInstance(value, bool)
    elif expected_type == "number":
        testcase.assertIsInstance(value, (int, float))
        testcase.assertNotIsInstance(value, bool)
    for bound, comparison in (("minimum", "assertGreaterEqual"), ("maximum", "assertLessEqual")):
        if bound in schema and expected_type in ("integer", "number"):
            getattr(testcase, comparison)(value, schema[bound])


class EmbeddingTests(unittest.TestCase):
    def test_fixture_requests_an_embedding(self):
        event = load_fixture()
        self.assertEqual(event["type"], "dating.embedding_requested")
        self.assertEqual(event["producer"], "dating")

    def test_produced_event_matches_the_published_contract(self):
        event = load_fixture()
        produced = new_worker().handle(event)

        self.assertEqual(len(produced), 1)
        result = produced[0]
        schema = json.loads(
            (CONTRACTS_DIR / "embedding.computed.v1.json").read_text(encoding="utf-8")
        )
        check_schema(self, result, schema, schema)

        self.assertEqual(result["payload"]["user_id"], event["payload"]["user_id"])
        self.assertEqual(result["payload"]["model_version"], "dating-qhash-v1")
        self.assertEqual(result["payload"]["dimension"], DIMENSION)
        self.assertEqual(result["payload"]["questionnaire_version"], 1)
        self.assertEqual(result["traceparent"], event["traceparent"])
        self.assertEqual(set(result["payload"]["vectors"]), set(BLOCKS))

    def test_vectors_are_unit_norm_and_never_exposed_to_the_client(self):
        result = new_worker().handle(load_fixture())[0]
        for block, vector in result["payload"]["vectors"].items():
            self.assertAlmostEqual(
                math.sqrt(sum(value * value for value in vector)), 1.0, places=8, msg=block
            )

    def test_replay_returns_the_same_result_without_computing_again(self):
        worker = new_worker()
        event = load_fixture()

        with patch("conexa_ai_worker.events.encode_profile", wraps=encode_profile) as encoder:
            first = worker.handle(event)
            second = worker.handle(event)

        self.assertEqual(first, second)
        self.assertEqual(encoder.call_count, 1)

    def test_answers_and_vectors_never_reach_the_logs(self):
        event = load_fixture()
        event["payload"]["answers"]["values"]["q_family"] = "secret-option-42"
        with self.assertLogs("conexa.ai_worker", level="INFO") as captured:
            worker = new_worker()
            worker.handle(event)
            worker.handle(event)
        logs = "\n".join(captured.output)
        self.assertNotIn("secret-option-42", logs)
        self.assertNotIn("q_family", logs)
        self.assertNotIn("vectors", logs)
        self.assertIn(event["id"], logs)


class DateCompletedTests(unittest.TestCase):
    def _event(self):
        first = encode_profile(load_fixture()["payload"]["answers"])
        second = encode_profile(
            {
                "values": {"q_family": "important", "q_money": "spend"},
                "personality": {"q_humor": ["dry"], "q_outgoing": 2},
                "lifestyle": {"q_night": "often", "q_sport": 5},
            }
        )
        return {
            "id": "b4f0c0de-0000-4000-8000-000000000001",
            "type": DATE_COMPLETED,
            "version": 1,
            "occurred_at": "2026-10-26T09:00:00Z",
            "producer": "dating",
            "payload": {
                "date_id": "d4f0c0de-0000-4000-8000-000000000002",
                "updates": [
                    {
                        "user_id": "user-a",
                        "outcome": "liked",
                        "current": first,
                        "partner": second,
                    },
                    {
                        "user_id": "user-b",
                        "outcome": "passed",
                        "current": second,
                        "partner": first,
                    },
                ],
            },
        }

    def test_produces_one_updated_event_per_participant(self):
        produced = new_worker().handle(self._event())
        self.assertEqual([event["type"] for event in produced], [VECTORS_UPDATED] * 2)
        self.assertEqual([event["payload"]["user_id"] for event in produced], ["user-a", "user-b"])

        schema = json.loads(
            (CONTRACTS_DIR / "dating.vectors_updated.v1.json").read_text(encoding="utf-8")
        )
        for event in produced:
            check_schema(self, event, schema, schema)
            self.assertEqual(event["payload"]["date_id"], "d4f0c0de-0000-4000-8000-000000000002")
            self.assertEqual(event["payload"]["update"], {"type": "rocchio", "alpha": 0.1, "beta": 0.05})
            for vector in event["payload"]["vectors"].values():
                self.assertAlmostEqual(math.sqrt(sum(value * value for value in vector)), 1.0, places=8)

    def test_no_update_means_no_event(self):
        event = self._event()
        event["payload"]["updates"] = []
        self.assertEqual(new_worker().handle(event), [])

    def test_invalid_outcome_is_rejected(self):
        event = self._event()
        event["payload"]["updates"][0]["outcome"] = "maybe"
        with self.assertRaises(InvalidEvent):
            new_worker().handle(event)

    def test_wrong_vector_dimension_is_rejected(self):
        event = self._event()
        event["payload"]["updates"][0]["current"]["values"] = [0.1, 0.2]
        with self.assertRaises(InvalidEvent):
            new_worker().handle(event)


class EnvelopeTests(unittest.TestCase):
    def test_unknown_event_type_is_rejected(self):
        event = load_fixture()
        event["type"] = "dating.unknown"
        with self.assertRaises(InvalidEvent):
            new_worker().handle(event)

    def test_wrong_producer_is_rejected(self):
        event = load_fixture()
        event["producer"] = "marketplace"
        with self.assertRaises(InvalidEvent):
            new_worker().handle(event)

    def test_missing_envelope_field_is_rejected(self):
        event = load_fixture()
        del event["traceparent"]
        del event["version"]
        with self.assertRaises(InvalidEvent):
            new_worker().handle(event)

    def test_invalid_occurred_at_is_rejected(self):
        event = load_fixture()
        event["occurred_at"] = "hier"
        with self.assertRaises(InvalidEvent):
            new_worker().handle(event)


class CliTests(unittest.TestCase):
    def test_stdin_event_produces_json(self):
        completed = subprocess.run(
            [sys.executable, "-m", "conexa_ai_worker"],
            cwd=SERVICE_DIR,
            input=FIXTURE.read_text(encoding="utf-8"),
            check=True,
            capture_output=True,
            text=True,
        )
        produced = json.loads(completed.stdout)
        self.assertEqual(produced[0]["type"], EMBEDDING_COMPUTED)
        self.assertEqual(produced[0]["producer"], "ai")


if __name__ == "__main__":
    unittest.main()
