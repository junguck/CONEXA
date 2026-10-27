import math
import unittest

from conexa_ai_worker.rocchio import (
    ALPHA,
    BETA,
    InvalidVectors,
    rocchio_update,
)


def cosine(left, right):
    dot = sum(a * b for a, b in zip(left, right))
    norm = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return dot / norm


class RocchioTests(unittest.TestCase):
    def assertVectorAlmostEqual(self, actual, expected, places=8):
        self.assertEqual(len(actual), len(expected))
        for a, e in zip(actual, expected):
            self.assertAlmostEqual(a, e, places=places)

    def test_constants_match_the_specification(self):
        self.assertEqual(ALPHA, 0.1)
        self.assertEqual(BETA, 0.05)

    def test_liked_partner_uses_alpha(self):
        updated = rocchio_update([1.0, 0.0], liked_partner=[0.0, 1.0])
        self.assertVectorAlmostEqual(updated, [0.993883735, 0.110431526])

    def test_rejected_partner_uses_beta(self):
        updated = rocchio_update([1.0, 0.0], rejected_partner=[0.0, -1.0])
        self.assertVectorAlmostEqual(updated, [0.998868138, 0.047565149])

    def test_both_terms_apply_in_order_then_normalise(self):
        updated = rocchio_update(
            [1.0, 0.0], liked_partner=[0.0, 1.0], rejected_partner=[0.0, -1.0]
        )
        self.assertVectorAlmostEqual(updated, [0.986813997, 0.16185838])

    def test_liked_partner_moves_towards_it(self):
        current = [1.0, 0.0, 0.0, 0.0]
        partner = [0.0, 1.0, 0.0, 0.0]
        updated = rocchio_update(current, liked_partner=partner)
        self.assertGreater(cosine(updated, partner), cosine(current, partner))
        self.assertAlmostEqual(math.sqrt(sum(v * v for v in updated)), 1.0, places=8)

    def test_rejected_partner_moves_away(self):
        current = [1.0, 0.0, 0.0, 0.0]
        partner = [0.0, 1.0, 0.0, 0.0]
        updated = rocchio_update(current, rejected_partner=partner)
        self.assertLess(cosine(updated, partner), cosine(current, partner))

    def test_without_partner_the_vector_is_only_renormalised(self):
        updated = rocchio_update([3.0, 4.0])
        self.assertVectorAlmostEqual(updated, [0.6, 0.8])

    def test_null_vector_stays_null(self):
        self.assertEqual(rocchio_update([0.0, 0.0]), [0.0, 0.0])

    def test_dimension_mismatch_is_rejected(self):
        with self.assertRaises(InvalidVectors):
            rocchio_update([1.0, 0.0], liked_partner=[0.0, 1.0, 0.0])

    def test_non_finite_values_are_rejected(self):
        with self.assertRaises(InvalidVectors):
            rocchio_update([1.0, float("nan")])

    def test_empty_vector_is_rejected(self):
        with self.assertRaises(InvalidVectors):
            rocchio_update([])


if __name__ == "__main__":
    unittest.main()
