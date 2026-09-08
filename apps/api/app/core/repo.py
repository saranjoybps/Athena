from datetime import datetime, timezone
from typing import Any

from app.core.errors import AppError
from app.core.store import DocumentStore


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def stamp_new(org_id: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    data = {"orgId": org_id, "createdAt": now_iso(), "updatedAt": now_iso(), "deletedAt": None}
    if extra:
        data.update(extra)
    return data


def org_owned(store: DocumentStore, collection: str, doc_id: str, org_id: str) -> dict[str, Any]:
    doc = store.get(collection, doc_id)
    if not doc or doc.get("deletedAt"):
        raise AppError(404, "not_found", "Record not found.")
    if doc.get("orgId") != org_id:
        raise AppError(404, "not_found", "Record not found.")
    return doc


def update_doc(
    store: DocumentStore,
    collection: str,
    doc_id: str,
    org_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    existing = org_owned(store, collection, doc_id, org_id)
    existing.update(payload)
    existing["updatedAt"] = now_iso()
    return store.set(collection, doc_id, existing)


def soft_delete(store: DocumentStore, collection: str, doc_id: str, org_id: str) -> dict[str, Any]:
    existing = org_owned(store, collection, doc_id, org_id)
    existing["deletedAt"] = now_iso()
    existing["updatedAt"] = now_iso()
    return store.set(collection, doc_id, existing)


def list_org(
    store: DocumentStore,
    collection: str,
    org_id: str,
    extra_filters: list[tuple[str, str, Any]] | None = None,
    order_by: str = "-createdAt",
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    filters: list[tuple[str, str, Any]] = [("orgId", "==", org_id)]
    if extra_filters:
        filters.extend(extra_filters)
    rows = store.query(collection, filters=filters, order_by=order_by, limit=limit, offset=offset)
    return [r for r in rows if not r.get("deletedAt")]


def list_org_by_customer(
    store: DocumentStore,
    collection: str,
    org_id: str,
    customer_id: str,
    *,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Org-scoped list filtered by customerId in Firestore (avoids reading the whole collection)."""
    return list_org(
        store,
        collection,
        org_id,
        extra_filters=[("customerId", "==", customer_id)],
        limit=limit,
    )