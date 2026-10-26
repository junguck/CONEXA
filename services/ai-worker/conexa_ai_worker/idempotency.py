"""Idempotency store used to replay an event with the same result (ADR 0003)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable

DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_MAX_ENTRIES = 10_000


@dataclass
class _Entry:
    expires_at: float
    value: Any


class InMemoryIdempotencyStore:
    """Bounded TTL store. Production will back this with Redis (F0.2/F0.6)."""

    def __init__(
        self,
        *,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        if max_entries <= 0:
            raise ValueError("max_entries must be positive")
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._clock = clock
        self._entries: dict[str, _Entry] = {}

    def get(self, key: str) -> Any | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= self._clock():
            del self._entries[key]
            return None
        return entry.value

    def put(self, key: str, value: Any) -> None:
        self._purge()
        if key not in self._entries and len(self._entries) >= self._max_entries:
            oldest = min(self._entries, key=lambda item: self._entries[item].expires_at)
            del self._entries[oldest]
        self._entries[key] = _Entry(expires_at=self._clock() + self._ttl, value=value)

    def _purge(self) -> None:
        now = self._clock()
        self._entries = {
            key: entry for key, entry in self._entries.items() if entry.expires_at > now
        }
