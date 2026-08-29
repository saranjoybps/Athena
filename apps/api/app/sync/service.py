from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.collections import SYNC_EVENTS
from app.core.context import RequestContext
from app.core.repo import now_iso, stamp_new
from app.core.store import DocumentStore

HANDLERS: dict[str, str] = {
    "attendance": "attendance",
    "daily_report": "daily_reports",
    "expense": "expenses",
    "photo": "site_photos",
    "measurement": "measurements",
}


def ingest(store: DocumentStore, ctx: RequestContext, events: list[dict[str, Any]]) -> dict[str, Any]:
    org_id = ctx.require_org()
    accepted = 0
    conflicts: list[dict[str, Any]] = []
    for event in events:
        key = event.get("clientIdempotencyKey") or event.get("idempotencyKey")
        if key:
            existing = store.get(SYNC_EVENTS, f"{org_id}:{key}")
            if existing:
                conflicts.append({"key": key, "reason": "duplicate", "existingId": existing.get("targetId")})
                continue
        target_id = event.get("targetId")
        store.create(
            SYNC_EVENTS,
            stamp_new(
                org_id,
                {
                    "userId": ctx.user_id,
                    "kind": event.get("kind"),
                    "payload": event.get("payload"),
                    "clientIdempotencyKey": key,
                    "targetId": target_id,
                    "status": "accepted",
                },
            ),
            doc_id=f"{org_id}:{key}" if key else None,
        )
        accepted += 1
    return {"accepted": accepted, "conflicts": conflicts, "syncedAt": now_iso()}
