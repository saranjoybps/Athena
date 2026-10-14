from __future__ import annotations

from typing import Any

from app.core.collections import (
    AUDIT_LOGS,
    CUSTOMER_FOLLOW_UPS,
    CUSTOMERS,
    ESTIMATES,
    EXPENSES,
    INVOICES,
    MEASUREMENTS,
    PAYMENTS,
    PROJECTS,
    PURCHASES,
    QUOTES,
    SITES,
    SITE_SURVEYS,
)
from app.core.concurrency import run_parallel
from app.core.repo import list_org, list_org_by_customer, now_iso, org_owned, stamp_new
from app.core.store import DocumentStore
from app.engines.units import D, money

# Money totals must see every row for one customer, not just the first page.
_SUMMARY_LIMIT = 300
_ACTIVITY_LIMIT = 60


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

_QUOTE_TO_ESTIMATE_STATUS = {
    "accepted": "approved",
    "invoiced": "approved",
    "rejected": "rejected",
    "sent": "sent",
    "modification_requested": "changes_requested",
}


def _project_costs(store: DocumentStore, org_id: str, project_ids: list[str]) -> tuple[Any, Any]:
    """Expenses + material purchases booked against the customer's projects."""
    if not project_ids:
        return D(0), D(0)
    expenses = D(0)
    purchases = D(0)
    for start in range(0, len(project_ids), 30):
        chunk = project_ids[start : start + 30]
        rows_e, rows_p = run_parallel(
            lambda c=chunk: list_org(store, EXPENSES, org_id, extra_filters=[("projectId", "in", c)], limit=_SUMMARY_LIMIT),
            lambda c=chunk: list_org(store, PURCHASES, org_id, extra_filters=[("projectId", "in", c)], limit=_SUMMARY_LIMIT),
        )
        expenses += sum((D(e.get("amount") or 0) for e in rows_e), D(0))
        purchases += sum((D(p.get("total") or 0) for p in rows_p), D(0))
    return money(expenses), money(purchases)


def _estimate_total(doc: dict[str, Any]) -> str:
    return str((doc.get("computed") or {}).get("grandTotal") or doc.get("total") or "0")


def _activity(
    customer: dict[str, Any],
    sites: list[dict[str, Any]],
    surveys: list[dict[str, Any]],
    measurements: list[dict[str, Any]],
    estimates: list[dict[str, Any]],
    quotes: list[dict[str, Any]],
    projects: list[dict[str, Any]],
    invoices: list[dict[str, Any]],
    payments: list[dict[str, Any]],
    follow_ups: list[dict[str, Any]],
    audits: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    site_names = {s["id"]: str(s.get("name") or "Site") for s in sites}
    estimate_by_id = {e["id"]: e for e in estimates}
    events: list[dict[str, Any]] = []

    def add(kind: str, at: Any, title: str, detail: str = "", ref: str | None = None, amount: Any = None) -> None:
        if not at:
            return
        events.append(
            {
                "id": f"{kind}:{ref or len(events)}",
                "kind": kind,
                "at": str(at),
                "title": title,
                "detail": detail,
                "refId": ref,
                "amount": str(amount) if amount is not None else None,
            }
        )

    add("customer", customer.get("createdAt"), "Customer added", ref=customer.get("id"))
    for a in audits:
        if a.get("action") == "customer.update":
            add("customer", a.get("createdAt"), "Customer details updated", ref=a.get("id"))
    for s in sites:
        add("site", s.get("createdAt"), f"Site added — {s.get('name') or 'Site'}", str(s.get("address") or ""), s["id"])
    for s in surveys:
        add(
            "survey",
            s.get("createdAt"),
            f"Survey {s.get('number') or ''} recorded".replace("  ", " "),
            site_names.get(str(s.get("siteId") or ""), ""),
            s["id"],
        )
    for m in measurements:
        add(
            "measurement",
            m.get("createdAt"),
            f"Measurement saved — {m.get('title') or m.get('notes') or 'site measurement'}",
            site_names.get(str(m.get("siteId") or ""), ""),
            m["id"],
        )
    for e in estimates:
        add(
            "estimate",
            e.get("createdAt"),
            f"Estimate {e.get('number') or ''} created".replace("  ", " "),
            str(e.get("title") or ""),
            e["id"],
            _estimate_total(e),
        )
        if int(e.get("version") or 1) > 1:
            add("estimate", e.get("updatedAt"), f"Estimate {e.get('number') or ''} revised (v{e.get('version')})", "", f"{e['id']}:v")
    for q in quotes:
        est = estimate_by_id.get(str(q.get("estimateId") or ""), {})
        label = est.get("number") or q.get("number") or ""
        if q.get("sentAt"):
            add("estimate", q.get("sentAt"), f"Estimate {label} sent to customer", "", f"{q['id']}:sent")
        status = q.get("status")
        if status in ("accepted", "invoiced", "rejected", "modification_requested") and q.get("decidedAt"):
            verb = {"rejected": "rejected", "modification_requested": "returned for changes"}.get(status, "approved")
            add("estimate", q.get("decidedAt"), f"Estimate {label} {verb}", "", f"{q['id']}:decided")
    for p in projects:
        add("project", p.get("createdAt"), f"Project started — {p.get('name') or p.get('number') or ''}", "", p["id"], p.get("contractValue"))
    for i in invoices:
        add(
            "invoice",
            i.get("createdAt"),
            f"Invoice {i.get('number') or ''} raised".replace("  ", " "),
            "Voided" if i.get("status") == "void" else "",
            i["id"],
            i.get("total") or i.get("total_amount"),
        )
    for pay in payments:
        add("payment", pay.get("createdAt"), "Payment received", str(pay.get("method") or "").replace("_", " "), pay["id"], pay.get("amount"))
    for f in follow_ups:
        add("followup", f.get("createdAt"), "Follow-up added", str(f.get("note") or ""), f["id"])
        if f.get("done"):
            add("followup", f.get("completedAt"), "Follow-up completed", str(f.get("note") or ""), f"{f['id']}:done")
    events.sort(key=lambda ev: ev["at"], reverse=True)
    return events[:_ACTIVITY_LIMIT]


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
        audits,
    ) = run_parallel(
        lambda: org_owned(store, CUSTOMERS, customer_id, org_id),
        *[
            (lambda c=collection: list_org_by_customer(store, c, org_id, customer_id, limit=_SUMMARY_LIMIT))
            for collection in _SUMMARY_COLLECTIONS
        ],
        lambda: list_org(store, AUDIT_LOGS, org_id, extra_filters=[("entityId", "==", customer_id)], limit=20),
    )
    site_ids = {s["id"] for s in sites}
    follow_ups = [f for f in all_follow_ups if not f.get("done")]
    follow_ups.sort(key=lambda f: str(f.get("dueAt") or f.get("createdAt") or ""))

    live_invoices = [i for i in invoices if i.get("status") != "void"]
    billed = money(sum((D(i.get("total") or i.get("total_amount") or 0) for i in live_invoices), D(0)))
    outstanding = money(sum((D(i.get("outstanding") or 0) for i in live_invoices), D(0)))
    collected = money(sum((D(p.get("amount") or 0) for p in payments), D(0)))
    live_projects = [p for p in projects if p.get("status") != "cancelled"]
    contract_value = money(
        sum((D(p.get("contractValue") or 0) + D(p.get("approvedChangeOrders") or 0) for p in live_projects), D(0))
    )
    expenses, purchases = _project_costs(store, org_id, [p["id"] for p in live_projects])
    costs = money(expenses + purchases)

    quote_by_estimate: dict[str, dict[str, Any]] = {}
    for q in sorted(quotes, key=lambda q: str(q.get("createdAt") or "")):
        if q.get("estimateId"):
            quote_by_estimate[str(q["estimateId"])] = q
    project_by_estimate: dict[str, str] = {}
    for p in projects:
        if p.get("estimateId"):
            project_by_estimate[str(p["estimateId"])] = p["id"]
        for est_id, q in quote_by_estimate.items():
            if p.get("quoteId") and p.get("quoteId") == q.get("id"):
                project_by_estimate.setdefault(est_id, p["id"])

    estimate_rows = []
    for e in estimates:
        quote = quote_by_estimate.get(e["id"]) or {}
        status = _QUOTE_TO_ESTIMATE_STATUS.get(str(quote.get("status") or ""), "draft")
        row = _brief(
            e, "title", "number", "siteId", "workType", "computed", "validUntil", "createdAt", "updatedAt", "version", "pdfUrl"
        )
        row.update({"status": status, "quoteId": quote.get("id"), "projectId": project_by_estimate.get(e["id"])})
        estimate_rows.append(row)
    approved_value = money(
        sum((D(_estimate_total(e)) for e in estimate_rows if e["status"] == "approved"), D(0))
    )

    per_site: dict[str, dict[str, int]] = {sid: {"surveys": 0, "measurements": 0, "estimates": 0} for sid in site_ids}
    for key, rows in (("surveys", surveys), ("measurements", measurements), ("estimates", estimates)):
        for r in rows:
            sid = str(r.get("siteId") or "")
            if sid in per_site:
                per_site[sid][key] += 1

    return {
        "customer": customer,
        "counts": {
            "sites": len(sites),
            "surveys": len(surveys),
            "measurements": len(measurements),
            "estimates": len(estimates),
            "quotes": len(quotes),
            "projects": len(projects),
            "invoices": len(live_invoices),
            "payments": len(payments),
            "openFollowUps": len(follow_ups),
        },
        "money": {
            "billed": str(billed),
            "outstanding": str(outstanding),
            "collected": str(collected),
            "contractValue": str(contract_value),
            "unbilled": str(money(max(contract_value - billed, D(0)))),
            "approvedEstimates": str(approved_value),
            "expenses": str(expenses),
            "purchases": str(purchases),
            "costs": str(costs),
            "profit": str(money(collected - costs)),
        },
        "sites": [
            {**_brief(s, "name", "address", "pinCode", "siteType", "lat", "lng", "createdAt"), "counts": per_site.get(s["id"])}
            for s in sites
        ],
        "surveys": [
            _brief(s, "number", "projectType", "scope", "siteId", "date", "notes", "clientRequirements", "createdAt")
            for s in surveys
        ],
        "measurements": [
            _brief(m, "title", "formulaKind", "notes", "siteId", "surveyId", "inputs", "outputs", "formulaConfig", "createdAt")
            for m in measurements
        ],
        "estimates": estimate_rows,
        "quotes": [
            _brief(q, "number", "status", "siteId", "estimateId", "computed", "total_amount", "createdAt") for q in quotes
        ],
        "projects": [
            _brief(p, "name", "number", "status", "siteId", "contractValue", "completionPercent", "billedToDate", "createdAt")
            for p in projects
        ],
        "invoices": [
            _brief(i, "number", "status", "projectId", "total", "total_amount", "outstanding", "dueDate", "createdAt")
            for i in invoices
        ],
        "payments": [_brief(p, "amount", "method", "invoiceId", "reference", "createdAt") for p in payments],
        "followUps": follow_ups,
        "activity": _activity(
            customer, sites, surveys, measurements, estimates, quotes, projects, invoices, payments, all_follow_ups, audits
        ),
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
                "note": note.strip(),
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
