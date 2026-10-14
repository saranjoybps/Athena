"""Customer → site → survey / measurement / estimate ownership rules and cascade deletes."""

from __future__ import annotations

from typing import Any

from app.core.collections import (
    CUSTOMER_FOLLOW_UPS,
    CUSTOMERS,
    DOCUMENTS,
    ESTIMATES,
    INVOICES,
    MEASUREMENTS,
    PAYMENTS,
    PROJECTS,
    QUOTES,
    SITE_SURVEYS,
    SITES,
)
from app.core.errors import AppError
from app.core.repo import list_org, now_iso, org_owned
from app.core.store import DocumentStore

_CASCADE_LIMIT = 500


def resolve_site_scope(
    store: DocumentStore,
    org_id: str,
    site_id: str,
    customer_id: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Site must exist; the customer always comes from the site so records can't be cross-linked."""
    if not site_id:
        raise AppError(400, "site_required", "Select a site first.")
    site = org_owned(store, SITES, site_id, org_id)
    site_customer = str(site.get("customerId") or "")
    if customer_id and site_customer and customer_id != site_customer:
        raise AppError(400, "site_customer_mismatch", "This site belongs to a different customer.")
    customer = org_owned(store, CUSTOMERS, site_customer or customer_id or "", org_id)
    return site, customer


def _rows(store: DocumentStore, collection: str, org_id: str, field: str, value: str) -> list[dict[str, Any]]:
    return list_org(store, collection, org_id, extra_filters=[(field, "==", value)], limit=_CASCADE_LIMIT)


def _soft_delete_rows(store: DocumentStore, collection: str, rows: list[dict[str, Any]], stamp: str) -> int:
    for row in rows:
        row["deletedAt"] = stamp
        row["updatedAt"] = stamp
        store.set(collection, row["id"], row)
    return len(rows)


def _financial_blockers(store: DocumentStore, org_id: str, field: str, value: str) -> dict[str, int]:
    projects = _rows(store, PROJECTS, org_id, field, value)
    invoices = [i for i in _rows(store, INVOICES, org_id, field, value) if i.get("status") != "void"]
    payments = _rows(store, PAYMENTS, org_id, field, value) if field == "customerId" else []
    return {
        k: v
        for k, v in {"projects": len(projects), "invoices": len(invoices), "payments": len(payments)}.items()
        if v
    }


def _blocked_message(what: str, blockers: dict[str, int]) -> str:
    parts = [f"{n} {name if n != 1 else name.rstrip('s')}" for name, n in blockers.items()]
    return (
        f"This {what} has {', '.join(parts)}. Financial records must be kept, "
        f"so the {what} can't be deleted."
    )


def delete_site_cascade(store: DocumentStore, org_id: str, site: dict[str, Any]) -> dict[str, int]:
    site_id = site["id"]
    blockers = _financial_blockers(store, org_id, "siteId", site_id)
    if blockers:
        raise AppError(409, "site_has_financial_records", _blocked_message("site", blockers), blockers)
    stamp = now_iso()
    removed = {
        "surveys": _soft_delete_rows(store, SITE_SURVEYS, _rows(store, SITE_SURVEYS, org_id, "siteId", site_id), stamp),
        "measurements": _soft_delete_rows(
            store, MEASUREMENTS, _rows(store, MEASUREMENTS, org_id, "siteId", site_id), stamp
        ),
        "estimates": _soft_delete_rows(store, ESTIMATES, _rows(store, ESTIMATES, org_id, "siteId", site_id), stamp),
        "quotes": _soft_delete_rows(store, QUOTES, _rows(store, QUOTES, org_id, "siteId", site_id), stamp),
        "files": _soft_delete_rows(store, DOCUMENTS, _rows(store, DOCUMENTS, org_id, "siteId", site_id), stamp),
    }
    _soft_delete_rows(store, SITES, [site], stamp)
    return removed


def delete_customer_cascade(store: DocumentStore, org_id: str, customer: dict[str, Any]) -> dict[str, int]:
    customer_id = customer["id"]
    blockers = _financial_blockers(store, org_id, "customerId", customer_id)
    if blockers:
        raise AppError(409, "customer_has_financial_records", _blocked_message("customer", blockers), blockers)
    removed = {"sites": 0, "surveys": 0, "measurements": 0, "estimates": 0, "quotes": 0, "files": 0}
    for site in _rows(store, SITES, org_id, "customerId", customer_id):
        removed["sites"] += 1
        for key, n in delete_site_cascade(store, org_id, site).items():
            removed[key] += n
    stamp = now_iso()
    # Records saved without a site (older data) still hang off the customer.
    for key, collection in (
        ("surveys", SITE_SURVEYS),
        ("measurements", MEASUREMENTS),
        ("estimates", ESTIMATES),
        ("quotes", QUOTES),
    ):
        removed[key] += _soft_delete_rows(store, collection, _rows(store, collection, org_id, "customerId", customer_id), stamp)
    removed["followUps"] = _soft_delete_rows(
        store, CUSTOMER_FOLLOW_UPS, _rows(store, CUSTOMER_FOLLOW_UPS, org_id, "customerId", customer_id), stamp
    )
    _soft_delete_rows(store, CUSTOMERS, [customer], stamp)
    return removed


def estimate_project(store: DocumentStore, org_id: str, estimate: dict[str, Any]) -> dict[str, Any] | None:
    projects = _rows(store, PROJECTS, org_id, "estimateId", estimate["id"])
    if projects:
        return projects[0]
    for quote in _rows(store, QUOTES, org_id, "estimateId", estimate["id"]):
        linked = _rows(store, PROJECTS, org_id, "quoteId", quote["id"])
        if linked:
            return linked[0]
    return None


def delete_estimate_cascade(store: DocumentStore, org_id: str, estimate: dict[str, Any]) -> dict[str, int]:
    project = estimate_project(store, org_id, estimate)
    if project:
        raise AppError(
            409,
            "estimate_has_project",
            "A project was started from this estimate, so it can't be deleted.",
            {"projectId": project.get("id")},
        )
    quotes = _rows(store, QUOTES, org_id, "estimateId", estimate["id"])
    if any(q.get("status") == "invoiced" for q in quotes):
        raise AppError(409, "estimate_invoiced", "This estimate has been invoiced, so it can't be deleted.")
    stamp = now_iso()
    removed = {"quotes": _soft_delete_rows(store, QUOTES, quotes, stamp)}
    _soft_delete_rows(store, ESTIMATES, [estimate], stamp)
    return removed
