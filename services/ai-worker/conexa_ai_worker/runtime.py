"""Transport-agnostic event loop for the AI worker.

The bus adapter (F0.4) supplies ``EventSource`` and ``EventSink``. This module
owns the order of operations: publish first, acknowledge second, so a crash
cannot lose an event silently. Validation failures are rejected (and optionally
recorded as dead letters) instead of being retried forever.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Protocol, Sequence

from .events import DatingWorker, InvalidEvent

logger = logging.getLogger("conexa.ai_worker")


@dataclass(frozen=True)
class Delivery:
    """One received event plus the transport's settlement callbacks."""

    event: Any
    ack: Callable[[], None]
    reject: Callable[[str], None]


class EventSource(Protocol):
    def receive(self) -> Delivery | None:
        """Return the next delivery, or ``None`` when nothing is available."""


class EventSink(Protocol):
    def publish(self, events: Sequence[Mapping[str, Any]]) -> None: ...


class DeadLetterSink(Protocol):
    def record(self, event: Any, reason: str) -> None: ...


class WorkerRuntime:
    """Runs the worker against any ack-aware source and any sink."""

    def __init__(
        self,
        source: EventSource,
        sink: EventSink,
        *,
        worker: DatingWorker | None = None,
        dead_letters: DeadLetterSink | None = None,
    ) -> None:
        self._source = source
        self._sink = sink
        self._worker = worker or DatingWorker()
        self._dead_letters = dead_letters

    def run_once(self) -> bool:
        """Process at most one delivery. Returns False when the source is empty."""
        delivery = self._source.receive()
        if delivery is None:
            return False
        try:
            produced = self._worker.handle(delivery.event)
        except InvalidEvent as exc:
            reason = str(exc)
            logger.warning(
                "event_rejected type=%s id=%s reason=%s",
                _label(delivery.event, "type"),
                _label(delivery.event, "id"),
                reason,
            )
            if self._dead_letters is not None:
                self._dead_letters.record(delivery.event, reason)
            delivery.reject(reason)
            return True
        if produced:
            self._sink.publish(produced)
        delivery.ack()
        return True

    def run(self, *, max_events: int | None = None) -> int:
        """Drain the source, optionally stopping after ``max_events`` deliveries."""
        if max_events is not None and max_events < 0:
            raise ValueError("max_events must not be negative")
        processed = 0
        while max_events is None or processed < max_events:
            if not self.run_once():
                break
            processed += 1
        return processed


def _label(event: Any, field: str) -> str:
    value = event.get(field) if isinstance(event, Mapping) else None
    return value if isinstance(value, str) and value else "-"


class InMemoryEventSource:
    """Non-durable source for tests and local runs; never a production bus."""

    def __init__(self) -> None:
        self._pending: list[Any] = []
        self.acked: list[Any] = []
        self.rejected: list[tuple[Any, str]] = []

    def push(self, event: Any) -> None:
        self._pending.append(event)

    def receive(self) -> Delivery | None:
        if not self._pending:
            return None
        event = self._pending.pop(0)
        return Delivery(
            event=event,
            ack=lambda: self.acked.append(event),
            reject=lambda reason: self.rejected.append((event, reason)),
        )

    def __len__(self) -> int:
        return len(self._pending)
