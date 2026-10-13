from __future__ import annotations

from typing import Any

from app.core.collections import (
    CUSTOMER_FOLLOW_UPS,
    CUSTOMERS,
    ESTIMATES,
    INVOICES,
    MEASUREMENTS,
    PAYMENTS,
    PROJECTS,
    QUOTES,
    SITES,
    SITE_SURVEYS,
)
from app.core.concurrency import run_parallel
from app.core.repo import list_org_by_customer, now_iso, org_owned, stamp_new
from app.core.store import DocumentStore
from app.engines.units import D, money


def _brief(doc: dict[str, Any], *keys: str) -> dict[str, Any]:
    out = {"id": doc.get("id")}
    for k in keys:
        if k in doc:
            out[k] = doc.get(k)
    return out


_SUMMARY_COLLECTIONS = (
    SITES,
    SITE_SURVEYS,
    MEASUREMENTS,
    ESTIMATES,
    QUOTES,
    PROJECTS,
    INVOICES,
    PAYMENTS,
    CUSTOMER_FOLLOW_UPS,
)


def customer_summary(store: DocumentStore, org_id: str, customer_id: str) -> dict[str, Any]:
    # Every list is org-scoped; the ownership check is first so its 404 surfaces before any list result.
    (
        customer,
        sites,
        surveys,
        measurements,
        estimates,
        quotes,
        projects,
        invoices,
        payments,
        all_follow_ups,
    ) = run_parallel(
        lambda: org_owned(store, CUSTOMERS, customer_id, org_id),
        *[
            (lambda c=collection: list_org_by_customer(store, c, org_id, customer_id))
            for collection in _SUMMARY_COLLECTIONS
        ],
    )
    site_ids = {s["id"] for s in sites}
    follow_ups = [f for f in all_follow_ups if not f.get("done")]
    follow_ups.sort(key=lambda f: str(f.get("dueAt") or f.get("createdAt") or ""))

    billed = money(sum(D(i.get("total") or i.get("total_amount") or 0) for i in invoices))
    outstanding = money(sum(D(i.get("outstanding") or 0) for i in invoices))
    collected = money(sum(D(p.get("amount") or 0) for p in payments))

    return {
        "customer": customer,
        "counts": {
            "sites": len(sites),
            "surveys": len(surveys),
            "measurements": len(measurements),
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
        "surveys": [_brief(s, "number", "projectType", "scope", "siteId", "date", "createdAt") for s in surveys],
        "measurements": [
            _brief(m, "formulaKind", "notes", "siteId", "surveyId", "outputs", "createdAt") for m in measurements
        ],
        "estimates": [
            _brief(e, "title", "number", "status", "siteId", "computed", "validUntil", "createdAt") for e in estimates
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
    items = list_org_by_customer(store, CUSTOMER_FOLLOW_UPS, org_id, customer_id)
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
