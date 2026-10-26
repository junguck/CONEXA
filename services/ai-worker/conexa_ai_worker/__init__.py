"""Convexa AI worker: deterministic embeddings and vector updates.

The worker is stateless with respect to user data: it receives answers or vectors
on the event bus, computes, and publishes results. Nothing is logged or stored.
"""

from .encoder import (
    BLOCKS,
    DIMENSION,
    MODEL_VERSION,
    InvalidAnswers,
    encode_profile,
)
from .events import DatingWorker, InvalidEvent, build_event, validate_envelope
from .idempotency import InMemoryIdempotencyStore
from .rocchio import (
    ALPHA,
    BETA,
    UPDATE_MODEL_VERSION,
    InvalidVectors,
    rocchio_update,
)

__all__ = [
    "ALPHA",
    "BETA",
    "BLOCKS",
    "DIMENSION",
    "DatingWorker",
    "InMemoryIdempotencyStore",
    "InvalidAnswers",
    "InvalidEvent",
    "InvalidVectors",
    "MODEL_VERSION",
    "UPDATE_MODEL_VERSION",
    "build_event",
    "encode_profile",
    "rocchio_update",
    "validate_envelope",
]
