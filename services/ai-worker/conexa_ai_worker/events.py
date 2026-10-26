"""Event handling for the dating slice: validate, compute, publish, deduplicate.

Only identifiers, block names and durations are logged. Answers and vectors are
personal data and never reach the logs (ADR 0003).
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Mapping

from .encoder import BLOCKS, DIMENSION, MODEL_VERSION, InvalidAnswers, encode_profile
from .idempotency import InMemoryIdempotencyStore
from .rocchio import ALPHA, BETA, UPDATE_MODEL_VERSION, InvalidVectors, rocchio_update

logger = logging.getLogger("conexa.ai_worker")

EMBEDDING_REQUESTED = "dating.embedding_requested"
EMBEDDING_COMPUTED = "embedding.computed"
DATE_COMPLETED = "date.completed"
VECTORS_UPDATED = "dating.vectors_updated"

PRODUCER = "ai"
OUTCOMES = ("liked", "passed")
_ENVELOPE_FIELDS = ("id", "type", "version", "occurred_at", "producer", "payload")


class InvalidEvent(ValueError):
    """Raised when an event cannot be processed safely."""


def validate_envelope(event: Any) -> None:
    if not isinstance(event, Mapping):
        raise InvalidEvent("event must be an object")
    missing = [field for field in _ENVELOPE_FIELDS if field not in event]
    if missing:
        raise InvalidEvent(f"missing envelope fields: {missing}")
    for field in ("id", "type", "producer"):
        value = event[field]
        if not isinstance(value, str) or not value.strip():
            raise InvalidEvent(f"{field} must be a non-empty string")
    version = event["version"]
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise InvalidEvent("version must be a positive integer")
    if not isinstance(event["occurred_at"], str):
        raise InvalidEvent("occurred_at must be an ISO-8601 string")
    _parse_datetime(event["occurred_at"])
    if not isinstance(event["payload"], Mapping):
        raise InvalidEvent("payload must be an object")
    if "traceparent" in event and not isinstance(event["traceparent"], str):
        raise InvalidEvent("traceparent must be a string")


def build_event(
    event_type: str,
    payload: Mapping[str, Any],
    *,
    traceparent: str | None = None,
    occurred_at: datetime | None = None,
    event_id: str | None = None,
) -> dict[str, Any]:
    moment = occurred_at or datetime.now(timezone.utc)
    event: dict[str, Any] = {
        "id": event_id or str(uuid.uuid4()),
        "type": event_type,
        "version": 1,
        "occurred_at": moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "producer": PRODUCER,
        "payload": dict(payload),
    }
    if traceparent is not None:
        event["traceparent"] = traceparent
    return event


class DatingWorker:
    """Consumes dating events and returns the events to publish."""

    def __init__(
        self,
        *,
        store: InMemoryIdempotencyStore | None = None,
        clock: Callable[[], datetime] | None = None,
        event_id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._store = store or InMemoryIdempotencyStore()
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._event_id_factory = event_id_factory or (lambda: str(uuid.uuid4()))

    def handle(self, event: Mapping[str, Any]) -> list[dict[str, Any]]:
        validate_envelope(event)
        key = f"{event['type']}:{event['id']}"
        cached = self._store.get(key)
        if cached is not None:
            logger.info("event_replayed type=%s id=%s", event["type"], event["id"])
            return cached

        started = time.perf_counter()
        produced = self._dispatch(event)
        self._store.put(key, produced)
        logger.info(
            "event_processed type=%s id=%s produced=%d duration_ms=%.1f",
            event["type"],
            event["id"],
            len(produced),
            (time.perf_counter() - started) * 1000,
        )
        return produced

    def _dispatch(self, event: Mapping[str, Any]) -> list[dict[str, Any]]:
        handlers = {
            EMBEDDING_REQUESTED: self._embedding_requested,
            DATE_COMPLETED: self._date_completed,
        }
        handler = handlers.get(event["type"])
        if handler is None:
            raise InvalidEvent(f"unsupported event type: {event['type']}")
        if event["producer"] != "dating":
            raise InvalidEvent("only the dating service produces these events")
        try:
            return handler(event)
        except (InvalidAnswers, InvalidVectors) as exc:
            raise InvalidEvent(str(exc)) from None

    def _embedding_requested(self, event: Mapping[str, Any]) -> list[dict[str, Any]]:
        payload = event["payload"]
        user_id = _identifier(payload, "user_id")
        profile_id = _identifier(payload, "profile_id")
        questionnaire_version = payload.get("questionnaire_version")
        if (
            isinstance(questionnaire_version, bool)
            or not isinstance(questionnaire_version, int)
            or questionnaire_version < 1
        ):
            raise InvalidEvent("questionnaire_version must be a positive integer")
        if "answers" not in payload:
            raise InvalidEvent("answers is required")

        vectors = encode_profile(payload["answers"])
        return [
            build_event(
                EMBEDDING_COMPUTED,
                {
                    "user_id": user_id,
                    "profile_id": profile_id,
                    "questionnaire_version": questionnaire_version,
                    "model_version": MODEL_VERSION,
                    "dimension": DIMENSION,
                    "vectors": vectors,
                },
                traceparent=event.get("traceparent"),
                occurred_at=self._clock(),
                event_id=self._event_id_factory(),
            )
        ]

    def _date_completed(self, event: Mapping[str, Any]) -> list[dict[str, Any]]:
        payload = event["payload"]
        date_id = _identifier(payload, "date_id")
        updates = payload.get("updates", [])
        if not isinstance(updates, list):
            raise InvalidEvent("updates must be an array")
        if len(updates) > 2:
            raise InvalidEvent("a date involves at most two participants")

        produced: list[dict[str, Any]] = []
        for update in updates:
            if not isinstance(update, Mapping):
                raise InvalidEvent("each update must be an object")
            user_id = _identifier(update, "user_id")
            outcome = update.get("outcome")
            if outcome not in OUTCOMES:
                raise InvalidEvent("outcome must be 'liked' or 'passed'")
            current = _block_vectors(update.get("current"), "current")
            partner = _block_vectors(update.get("partner"), "partner")

            vectors = {
                block: rocchio_update(
                    current[block],
                    liked_partner=partner[block] if outcome == "liked" else None,
                    rejected_partner=partner[block] if outcome == "passed" else None,
                )
                for block in BLOCKS
            }
            produced.append(
                build_event(
                    VECTORS_UPDATED,
                    {
                        "user_id": user_id,
                        "date_id": date_id,
                        "model_version": MODEL_VERSION,
                        "update_model_version": UPDATE_MODEL_VERSION,
                        "update": {"type": "rocchio", "alpha": ALPHA, "beta": BETA},
                        "vectors": vectors,
                    },
                    traceparent=event.get("traceparent"),
                    occurred_at=self._clock(),
                    event_id=self._event_id_factory(),
                )
            )
        return produced


def _identifier(payload: Mapping[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise InvalidEvent(f"{field} must be a non-empty string")
    return value


def _block_vectors(value: Any, field: str) -> dict[str, list[float]]:
    if not isinstance(value, Mapping):
        raise InvalidEvent(f"{field} must be an object grouped by block")
    if set(value) != set(BLOCKS):
        raise InvalidEvent(f"{field} must contain exactly the three blocks")
    vectors: dict[str, list[float]] = {}
    for block in BLOCKS:
        vector = value[block]
        if (
            not isinstance(vector, (list, tuple))
            or len(vector) != DIMENSION
            or any(isinstance(item, bool) or not isinstance(item, (int, float)) for item in vector)
        ):
            raise InvalidEvent(f"{field}.{block} must be {DIMENSION} numbers")
        vectors[block] = list(vector)
    return vectors


def _parse_datetime(value: str) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise InvalidEvent("occurred_at must be a valid ISO-8601 datetime") from None
