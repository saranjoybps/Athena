from __future__ import annotations

from typing import Any

from app.core.collections import PLATFORM_APP_SETTINGS, PLATFORM_TENANTS, PLATFORM_UPGRADE_REQUESTS
from app.core.store import DocumentStore, get_store
from app.platform.models import iso

APP_SETTINGS_DOC_ID = "default"


def get_platform_tenant(org_id: str, store: DocumentStore | None = None) -> dict[str, Any] | None:
    if not org_id:
        return None
    return (store or get_store()).get(PLATFORM_TENANTS, org_id)


def set_platform_tenant(org_id: str, data: dict[str, Any], store: DocumentStore | None = None) -> dict[str, Any]:
    payload = {**data, "id": org_id, "updatedAt": iso()}
    return (store or get_store()).set(PLATFORM_TENANTS, org_id, payload)


def update_platform_tenant(org_id: str, updates: dict[str, Any], store: DocumentStore | None = None) -> dict[str, Any]:
    db = store or get_store()
    existing = db.get(PLATFORM_TENANTS, org_id) or {"id": org_id}
    existing.update(updates)
    existing["id"] = org_id
    existing["updatedAt"] = iso()
    return db.set(PLATFORM_TENANTS, org_id, existing)


def list_platform_tenants(store: DocumentStore | None = None) -> list[dict[str, Any]]:
    return (store or get_store()).query(PLATFORM_TENANTS, filters=[], limit=500, order_by="-createdAt")


def get_app_settings(store: DocumentStore | None = None) -> dict[str, Any]:
    doc = (store or get_store()).get(PLATFORM_APP_SETTINGS, APP_SETTINGS_DOC_ID)
    return doc or {"id": APP_SETTINGS_DOC_ID}


def set_app_settings(updates: dict[str, Any], updated_by: str, store: DocumentStore | None = None) -> dict[str, Any]:
    db = store or get_store()
    existing = db.get(PLATFORM_APP_SETTINGS, APP_SETTINGS_DOC_ID) or {"id": APP_SETTINGS_DOC_ID}
    existing.update(updates)
    existing["id"] = APP_SETTINGS_DOC_ID
    existing["updatedAt"] = iso()
    existing["updated_by"] = updated_by
    return db.set(PLATFORM_APP_SETTINGS, APP_SETTINGS_DOC_ID, existing)


def list_upgrade_requests(
    *,
    status: str | None = None,
    org_id: str | None = None,
    store: DocumentStore | None = None,
) -> list[dict[str, Any]]:
    filters: list[tuple[str, str, Any]] = []
    if status:
        filters.append(("status", "==", status))
    if org_id:
        filters.append(("org_id", "==", org_id))
    return (store or get_store()).query(PLATFORM_UPGRADE_REQUESTS, filters=filters, limit=200, order_by="-createdAt")


def get_pending_upgrade(org_id: str, store: DocumentStore | None = None) -> dict[str, Any] | None:
    rows = list_upgrade_requests(org_id=org_id, store=store)
    return next((r for r in rows if r.get("status") == "pending"), None)


def set_upgrade_request(doc_id: str, data: dict[str, Any], store: DocumentStore | None = None) -> dict[str, Any]:
    payload = {**data, "id": doc_id, "updatedAt": iso()}
    return (store or get_store()).set(PLATFORM_UPGRADE_REQUESTS, doc_id, payload)
