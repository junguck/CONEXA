import json
import math
import unittest
from pathlib import Path

from conexa_ai_worker.encoder import BLOCKS, DIMENSION
from conexa_ai_worker.events import EMBEDDING_COMPUTED, DatingWorker, InvalidEvent

SERVICE_DIR = Path(__file__).resolve().parents[1]
CONSUMER_DIR = SERVICE_DIR / "tests" / "fixtures" / "consumer"
MANIFEST = json.loads((CONSUMER_DIR / "cases.json").read_text(encoding="utf-8"))


def load(relative):
    return json.loads((CONSUMER_DIR / relative).read_text(encoding="utf-8"))


class ConsumerContractTests(unittest.TestCase):
    def test_manifest_is_versioned_for_the_dating_event(self):
        self.assertEqual(MANIFEST["event"], "dating.embedding_requested")
        self.assertEqual(MANIFEST["version"], 1)
        self.assertEqual(MANIFEST["producer"], "dating")

    def test_valid_fixtures_are_accepted(self):
        for case in MANIFEST["valid"]:
            with self.subTest(fixture=case["fixture"]):
                produced = DatingWorker().handle(load(case["fixture"]))

                self.assertEqual(len(produced), 1)
                event = produced[0]
                self.assertEqual(event["type"], EMBEDDING_COMPUTED)
                self.assertEqual(event["payload"]["dimension"], DIMENSION)
                self.assertEqual(set(event["payload"]["vectors"]), set(BLOCKS))
                for block, vector in event["payload"]["vectors"].items():
                    self.assertEqual(len(vector), DIMENSION, block)
                    norm = math.sqrt(sum(value * value for value in vector))
                    self.assertTrue(
                        norm == 0.0 or abs(norm - 1.0) < 1e-8,
                        f"{case['fixture']}:{block} is not null or unit norm",
                    )

    def test_invalid_fixtures_are_rejected_with_the_documented_reason(self):
        for case in MANIFEST["invalid"]:
            with self.subTest(fixture=case["fixture"]):
                with self.assertRaises(InvalidEvent) as caught:
                    DatingWorker().handle(load(case["fixture"]))
                self.assertIn(case["reason"], str(caught.exception))

    def test_multi_choice_order_does_not_change_the_vectors(self):
        full = DatingWorker().handle(load("valid/full.json"))[0]["payload"]["vectors"]
        reordered = DatingWorker().handle(load("valid/multi-choice-reordered.json"))[0][
            "payload"
        ]["vectors"]

        self.assertEqual(full, reordered)

    def test_empty_blocks_produce_null_vectors(self):
        vectors = DatingWorker().handle(load("valid/empty-blocks.json"))[0]["payload"][
            "vectors"
        ]

        for block in BLOCKS:
            self.assertEqual(vectors[block], [0.0] * DIMENSION, block)

    def test_manifest_lists_every_fixture(self):
        listed = {
            case["fixture"]
            for group in ("valid", "invalid")
            for case in MANIFEST[group]
        }
        found = {
            path.relative_to(CONSUMER_DIR).as_posix()
            for path in CONSUMER_DIR.rglob("*.json")
            if path.name != "cases.json"
        }

        self.assertEqual(listed, found)


if __name__ == "__main__":
    unittest.main()
