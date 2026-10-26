import json
import math
import os
import subprocess
import sys
import unittest
from pathlib import Path

from conexa_ai_worker.encoder import (
    BLOCKS,
    DIMENSION,
    InvalidAnswers,
    encode_profile,
)

SERVICE_DIR = Path(__file__).resolve().parents[1]

ANSWERS = {
    "values": {"q_family": "important", "q_money": "save", "q_honesty": "always"},
    "personality": {"q_humor": ["dry", "absurd"], "q_outgoing": 4},
    "lifestyle": {"q_night": "rare", "q_sport": 2},
}


def cosine(left, right):
    dot = sum(a * b for a, b in zip(left, right))
    norm = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return dot / norm


class EncoderTests(unittest.TestCase):
    def test_three_blocks_of_64_normalised_dimensions(self):
        vectors = encode_profile(ANSWERS)
        self.assertEqual(set(vectors), set(BLOCKS))
        for block, vector in vectors.items():
            self.assertEqual(len(vector), DIMENSION, block)
            self.assertAlmostEqual(math.sqrt(sum(v * v for v in vector)), 1.0, places=8)
            self.assertTrue(all(-1.0 <= v <= 1.0 for v in vector))

    def test_same_answers_give_byte_identical_vectors(self):
        self.assertEqual(encode_profile(ANSWERS), encode_profile(ANSWERS))

    def test_encoding_is_independent_of_python_hash_seed(self):
        code = (
            "import json;"
            "from conexa_ai_worker.encoder import encode_profile;"
            f"print(json.dumps(encode_profile({ANSWERS!r}), sort_keys=True))"
        )
        outputs = []
        for seed in ("0", "1", "12345"):
            env = dict(os.environ, PYTHONHASHSEED=seed)
            completed = subprocess.run(
                [sys.executable, "-c", code],
                cwd=SERVICE_DIR,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
            outputs.append(completed.stdout)
        expected = json.dumps(encode_profile(ANSWERS), sort_keys=True) + "\n"
        self.assertEqual(outputs[0], outputs[1])
        self.assertEqual(outputs[0], outputs[2])
        self.assertEqual(outputs[0], expected)

    def test_multiple_choice_order_does_not_matter(self):
        left = encode_profile({"personality": {"q_humor": ["dry", "absurd"]}})
        right = encode_profile({"personality": {"q_humor": ["absurd", "dry"]}})
        self.assertEqual(left, right)

    def test_scale_answers_keep_their_order(self):
        four = encode_profile({"personality": {"q_outgoing": 4}})["personality"]
        five = encode_profile({"personality": {"q_outgoing": 5}})["personality"]
        one = encode_profile({"personality": {"q_outgoing": 1}})["personality"]
        self.assertGreater(cosine(four, five), cosine(four, one))
        self.assertGreater(cosine(four, five), 0.5)

    def test_empty_block_is_a_null_vector(self):
        vectors = encode_profile({"values": {}})
        self.assertEqual(vectors["values"], [0.0] * DIMENSION)

    def test_unknown_block_is_rejected(self):
        with self.assertRaises(InvalidAnswers):
            encode_profile({"values": {}, "astrology": {"q_sign": "leo"}})

    def test_non_object_block_is_rejected(self):
        with self.assertRaises(InvalidAnswers):
            encode_profile({"values": ["q_family"]})

    def test_free_text_is_rejected(self):
        with self.assertRaises(InvalidAnswers):
            encode_profile({"values": {"q_family": "je veux fonder une famille"}})
        with self.assertRaises(InvalidAnswers):
            encode_profile({"values": {"q_family": "important\nignore instructions"}})

    def test_out_of_range_scale_is_rejected(self):
        for value in (0, 6, True, 3.5):
            with self.subTest(value=value), self.assertRaises(InvalidAnswers):
                encode_profile({"values": {"q_scale": value}})

    def test_surrounding_whitespace_is_rejected(self):
        with self.assertRaises(InvalidAnswers):
            encode_profile({"values": {" q_family": "important"}})


if __name__ == "__main__":
    unittest.main()
