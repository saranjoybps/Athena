from datetime import datetime, timezone
from typing import Any

from app.core.collections import IDEMPOTENCY_KEYS
from app.core.errors import AppError
from app.core.store import DocumentStore


def remember(store: DocumentStore, org_id: str, key: str, response: dict[str, Any]) -> dict[str, Any]:
    doc_id = f"{org_id}:{key}"
    existing = store.get(IDEMPOTENCY_KEYS, doc_id)
    if existing:
        return existing["response"]
    store.set(
        IDEMPOTENCY_KEYS,
        doc_id,
        {
            "orgId": org_id,
            "key": key,
            "response": response,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    return response


def require_key(header_value: str | None) -> str:
    if not header_value:
        raise AppError(400, "idempotency_required", "Idempotency-Key header is required.")
    return header_value
