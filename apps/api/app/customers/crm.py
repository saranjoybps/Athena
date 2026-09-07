from __future__ import annotations

from typing import Any

from app.core.collections import (
    CUSTOMER_FOLLOW_UPS,
    CUSTOMERS,
    ESTIMATES,
    INVOICES,
    PAYMENTS,
    PROJECTS,
    QUOTES,
    SITES,
    SITE_SURVEYS,
)
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import DocumentStore
from app.engines.units import D, money


def _brief(doc: dict[str, Any], *keys: str) -> dict[str, Any]:
    out = {"id": doc.get("id")}
    for k in keys:
        if k in doc:
            out[k] = doc.get(k)
    return out


def customer_summary(store: DocumentStore, org_id: str, customer_id: str) -> dict[str, Any]:
    customer = org_owned(store, CUSTOMERS, customer_id, org_id)
    sites = [s for s in list_org(store, SITES, org_id) if s.get("customerId") == customer_id]
    site_ids = {s["id"] for s in sites}
    surveys = [s for s in list_org(store, SITE_SURVEYS, org_id) if s.get("customerId") == customer_id]
    estimates = [e for e in list_org(store, ESTIMATES, org_id) if e.get("customerId") == customer_id]
    quotes = [q for q in list_org(store, QUOTES, org_id) if q.get("customerId") == customer_id]
    projects = [p for p in list_org(store, PROJECTS, org_id) if p.get("customerId") == customer_id]
    invoices = [i for i in list_org(store, INVOICES, org_id) if i.get("customerId") == customer_id]
    payments = [p for p in list_org(store, PAYMENTS, org_id) if p.get("customerId") == customer_id]
    follow_ups = [
        f
        for f in list_org(store, CUSTOMER_FOLLOW_UPS, org_id)
        if f.get("customerId") == customer_id and not f.get("done")
    ]
    follow_ups.sort(key=lambda f: str(f.get("dueAt") or f.get("createdAt") or ""))

    billed = money(sum(D(i.get("total") or i.get("total_amount") or 0) for i in invoices))
    outstanding = money(sum(D(i.get("outstanding") or 0) for i in invoices))
    collected = money(sum(D(p.get("amount") or 0) for p in payments))

    return {
        "customer": customer,
        "counts": {
            "sites": len(sites),
            "surveys": len(surveys),
            "estimates": len(estimates),
            "quotes": len(quotes),
            "projects": len(projects),
            "invoices": len(invoices),
            "payments": len(payments),
            "openFollowUps": len(follow_ups),
        },
        "money": {
            "billed": str(billed),
            "outstanding": str(outstanding),
            "collected": str(collected),
        },
        "sites": [_brief(s, "name", "address", "pinCode", "siteType") for s in sites],
        "surveys": [_brief(s, "number", "projectType", "scope", "siteId", "createdAt") for s in surveys],
        "estimates": [
            _brief(e, "title", "number", "status", "siteId", "computed", "createdAt") for e in estimates
        ],
        "quotes": [
            _brief(q, "number", "status", "siteId", "computed", "total_amount", "createdAt") for q in quotes
        ],
        "projects": [
            _brief(p, "name", "number", "status", "siteId", "contractValue", "completionPercent") for p in projects
        ],
        "invoices": [
            _brief(i, "number", "status", "projectId", "total", "total_amount", "outstanding", "createdAt")
            for i in invoices
        ],
        "payments": [_brief(p, "amount", "method", "invoiceId", "reference", "createdAt") for p in payments],
        "followUps": follow_ups,
        "siteIds": list(site_ids),
    }


def list_follow_ups(store: DocumentStore, org_id: str, customer_id: str) -> list[dict[str, Any]]:
    org_owned(store, CUSTOMERS, customer_id, org_id)
    items = [f for f in list_org(store, CUSTOMER_FOLLOW_UPS, org_id) if f.get("customerId") == customer_id]
    items.sort(key=lambda f: str(f.get("dueAt") or f.get("createdAt") or ""), reverse=True)
    return items


def create_follow_up(
    store: DocumentStore,
    org_id: str,
    customer_id: str,
    *,
    note: str,
    due_at: str | None,
    user_id: str,
) -> dict[str, Any]:
    org_owned(store, CUSTOMERS, customer_id, org_id)
    return store.create(
        CUSTOMER_FOLLOW_UPS,
        stamp_new(
            org_id,
            {
                "customerId": customer_id,
                "note": note,
                "dueAt": due_at,
                "done": False,
                "createdBy": user_id,
                "createdAt": now_iso(),
            },
        ),
    )


def complete_follow_up(store: DocumentStore, org_id: str, follow_up_id: str) -> dict[str, Any]:
    doc = org_owned(store, CUSTOMER_FOLLOW_UPS, follow_up_id, org_id)
    doc["done"] = True
    doc["completedAt"] = now_iso()
    return store.set(CUSTOMER_FOLLOW_UPS, follow_up_id, doc)
