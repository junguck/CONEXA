"""Idempotency stores used to replay an event with the same result (ADR 0003).

Two adapters share one tiny contract:

- :class:`InMemoryIdempotencyStore` is bounded and TTL-based; development and tests.
- :class:`RedisIdempotencyStore` is durable and production-oriented. It only needs
  a client exposing ``GET`` and ``SET ... EX`` (redis-py, Valkey, or a fake in tests).

A cache hit must never recompute. A stored value that cannot be trusted raises
:class:`IdempotencyError` instead of silently recomputing and republishing.
"""

from __future__ import annotations

import copy
import json
import time
from dataclasses import dataclass
from typing import Any, Callable, Protocol

DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_MAX_ENTRIES = 10_000
DEFAULT_KEY_PREFIX = "conexa:ai:idempotency:"


class IdempotencyError(RuntimeError):
    """Raised when a stored result is corrupt or cannot be serialised."""


class IdempotencyStore(Protocol):
    def get(self, key: str) -> Any | None: ...

    def put(self, key: str, value: Any) -> None: ...


class RedisLike(Protocol):
    """Minimal structural contract satisfied by ``redis.Redis``."""

    def get(self, name: str) -> bytes | str | None: ...

    def set(self, name: str, value: str, ex: int | None = None) -> Any: ...


@dataclass
class _Entry:
    expires_at: float
    value: Any


class InMemoryIdempotencyStore:
    """Bounded TTL store. Values are copied so callers cannot mutate the cache."""

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
        return copy.deepcopy(entry.value)

    def put(self, key: str, value: Any) -> None:
        self._purge()
        if key not in self._entries and len(self._entries) >= self._max_entries:
            oldest = min(self._entries, key=lambda item: self._entries[item].expires_at)
            del self._entries[oldest]
        self._entries[key] = _Entry(
            expires_at=self._clock() + self._ttl,
            value=copy.deepcopy(value),
        )

    def _purge(self) -> None:
        now = self._clock()
        self._entries = {
            key: entry for key, entry in self._entries.items() if entry.expires_at > now
        }


class RedisIdempotencyStore:
    """Durable idempotency cache stored as JSON with a TTL.

    Keys are namespaced: ``<prefix><type>:<event id>``. Reads validate the shape
    (a JSON array of objects) because a corrupt entry means the duplicate
    protection cannot be trusted.

    ``GET`` then ``SET`` are not atomic: two concurrent workers may both compute
    the same event. Outputs are deterministic and consumers deduplicate on the
    event id, so this only costs duplicate work, never divergent data.
    """

    def __init__(
        self,
        client: RedisLike,
        *,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        prefix: str = DEFAULT_KEY_PREFIX,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        if not prefix:
            raise ValueError("prefix must not be empty")
        self._client = client
        self._ttl = ttl_seconds
        self._prefix = prefix

    def get(self, key: str) -> Any | None:
        raw = self._client.get(self._scoped_key(key))
        if raw is None:
            return None
        if isinstance(raw, bytes):
            try:
                raw = raw.decode("utf-8")
            except UnicodeDecodeError:
                raise IdempotencyError("stored result is not valid UTF-8") from None
        if not isinstance(raw, str):
            raise IdempotencyError("stored result is not text")
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            raise IdempotencyError("stored result is not valid JSON") from None
        if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
            raise IdempotencyError("stored result must be an array of objects")
        return value

    def put(self, key: str, value: Any) -> None:
        try:
            payload = json.dumps(
                value,
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
            )
        except (TypeError, ValueError):
            raise IdempotencyError("result is not JSON-serialisable") from None
        self._client.set(self._scoped_key(key), payload, ex=self._ttl)

    def _scoped_key(self, key: str) -> str:
        if not isinstance(key, str) or not key.strip():
            raise ValueError("key must be a non-empty string")
        return f"{self._prefix}{key}"
