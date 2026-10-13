"""Bounded fan-out for independent blocking I/O (Firestore reads) inside one request."""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any

_MAX_WORKERS = 24
_local = threading.local()


def _mark_worker() -> None:
    _local.in_pool = True


_POOL = ThreadPoolExecutor(
    max_workers=_MAX_WORKERS,
    thread_name_prefix="athena-io",
    initializer=_mark_worker,
)


def _in_pool() -> bool:
    return getattr(_local, "in_pool", False)


def submit(fn: Callable[[], Any]) -> Future:
    """Schedule ``fn`` on the shared pool. Inside a pool worker it runs inline to avoid pool deadlock."""
    if _in_pool():
        fut: Future = Future()
        try:
            fut.set_result(fn())
        except BaseException as exc:  # noqa: BLE001 — re-raised by .result()
            fut.set_exception(exc)
        return fut
    return _POOL.submit(fn)


def run_parallel(*calls: Callable[[], Any]) -> list[Any]:
    """Run independent calls concurrently and return results in order. First exception wins."""
    futures = [submit(c) for c in calls]
    return [f.result() for f in futures]
