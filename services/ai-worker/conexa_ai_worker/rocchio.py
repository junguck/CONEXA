"""Rocchio vector update applied after a completed date (ADR 0003).

v' = v + alpha * (v_liked - v) - beta * (v_rejected - v), then L2-normalised.
A single date involves one partner: either the alpha term or the beta term is
supplied. Both may be supplied for batch maintenance.
"""

from __future__ import annotations

import math
from typing import Sequence

ALPHA = 0.1
BETA = 0.05
UPDATE_MODEL_VERSION = "dating-rocchio-v1"


class InvalidVectors(ValueError):
    """Raised when vectors cannot be combined safely."""


def rocchio_update(
    current: Sequence[float],
    liked_partner: Sequence[float] | None = None,
    rejected_partner: Sequence[float] | None = None,
    *,
    alpha: float = ALPHA,
    beta: float = BETA,
) -> list[float]:
    """Return the updated, L2-normalised vector for one block."""
    vector = _validated(current, "current")
    dimension = len(vector)

    if liked_partner is not None:
        liked = _validated(liked_partner, "liked_partner")
        _require_dimension(liked, dimension, "liked_partner")
        vector = [value + alpha * (partner - value) for value, partner in zip(vector, liked)]
    if rejected_partner is not None:
        rejected = _validated(rejected_partner, "rejected_partner")
        _require_dimension(rejected, dimension, "rejected_partner")
        vector = [value - beta * (partner - value) for value, partner in zip(vector, rejected)]

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        return [0.0] * dimension
    return [round(value / norm, 9) for value in vector]


def _validated(vector: Sequence[float], name: str) -> list[float]:
    if isinstance(vector, (str, bytes)) or not isinstance(vector, Sequence):
        raise InvalidVectors(f"{name} must be a sequence of numbers")
    values = [float(value) for value in vector]
    if not values:
        raise InvalidVectors(f"{name} must not be empty")
    if any(not math.isfinite(value) for value in values):
        raise InvalidVectors(f"{name} contains a non-finite value")
    return values


def _require_dimension(vector: Sequence[float], dimension: int, name: str) -> None:
    if len(vector) != dimension:
        raise InvalidVectors(f"{name} has dimension {len(vector)}, expected {dimension}")
