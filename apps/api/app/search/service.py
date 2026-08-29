from __future__ import annotations

from typing import Any

from app.core.collections import (
    CUSTOMERS,
    ESTIMATES,
    INVOICES,
    LABOUR,
    MATERIALS,
    PROJECTS,
    QUOTES,
    SITES,
    SUPPLIERS,
)
from app.core.repo import list_org
from app.core.store import DocumentStore

SEARCHABLE = [
    (CUSTOMERS, ["name", "phone", "email", "company"]),
    (SITES, ["name", "address", "phone"]),
    (PROJECTS, ["name", "number"]),
    (ESTIMATES, ["title", "number"]),
    (QUOTES, ["number", "notes"]),
    (INVOICES, ["number"]),
    (MATERIALS, ["name", "sku", "category"]),
    (LABOUR, ["name", "trade"]),
    (SUPPLIERS, ["name", "company", "phone"]),
]


def global_search(store: DocumentStore, org_id: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
    q = query.strip().lower()
    if not q:
        return []
    results: list[dict[str, Any]] = []
    for collection, fields in SEARCHABLE:
        for row in list_org(store, collection, org_id, limit=200):
            hay = " ".join(str(row.get(f) or "") for f in fields).lower()
            if q in hay or q in str(row.get("number", "")).lower():
                results.append(
                    {
                        "type": collection,
                        "id": row["id"],
                        "label": row.get("name") or row.get("title") or row.get("number") or row["id"],
                        "subtitle": row.get("phone") or row.get("address") or row.get("status"),
                    }
                )
            if len(results) >= limit:
                return results
    return results
