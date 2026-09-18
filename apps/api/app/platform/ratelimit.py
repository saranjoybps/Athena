from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from app.core.errors import AppError

_hits: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def reset_limits() -> None:
    with _lock:
        _hits.clear()


def limit_ip(ip: str, *, max_hits: int, window_seconds: int, code: str = "rate_limited") -> None:
    now = time.time()
    with _lock:
        recent = [t for t in _hits[ip] if now - t < window_seconds]
        if len(recent) >= max_hits:
            _hits[ip] = recent
            raise AppError(429, code, "Too many requests. Try again later.")
        recent.append(now)
        _hits[ip] = recent
