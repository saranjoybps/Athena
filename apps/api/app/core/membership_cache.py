from __future__ import annotations

import time
from typing import Any

from app.core.collections import MEMBERSHIPS
from app.core.store import DocumentStore

# Short-lived cache so every API request does not re-read memberships from Firestore.
_MEMBERSHIP_TTL_SEC = 90.0
_membership_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def get_memberships_for_user(store: DocumentStore, user_id: str) -> list[dict[str, Any]]:
    now = time.monotonic()
    hit = _membership_cache.get(user_id)
    if hit and now - hit[0] < _MEMBERSHIP_TTL_SEC:
        return hit[1]
    rows = store.query(MEMBERSHIPS, filters=[("userId", "==", user_id)], limit=20)
    _membership_cache[user_id] = (now, rows)
    return rows


def invalidate_membership_cache(user_id: str | None = None) -> None:
    if user_id:
        _membership_cache.pop(user_id, None)
    else:
        _membership_cache.clear()
