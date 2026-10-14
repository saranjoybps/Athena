from __future__ import annotations

from typing import Any

from app.core.collections import (
    ACCOUNTING_ENTRIES,
    CHANGE_ORDERS,
    CUSTOMERS,
    EXPENSES,
    INVOICES,
    MATERIAL_REQUESTS,
    MEASUREMENTS,
    PAYMENTS,
    PROJECTS,
    PURCHASES,
    QUOTES,
    SITES,
    SNAGS,
)
from app.core.concurrency import run_parallel
from app.core.repo import list_org
from app.core.store import DocumentStore
from app.engines.units import D, money


def owner_dashboard(store: DocumentStore, org_id: str) -> dict[str, Any]:
    # Keep dashboard cheap: small page size, no over-fetch.
    projects, quotes, invoices, payments, expenses, change_orders, material_requests = run_parallel(
        *[
            (lambda c=collection: list_org(store, c, org_id, limit=40))
            for collection in (PROJECTS, QUOTES, INVOICES, PAYMENTS, EXPENSES, CHANGE_ORDERS, MATERIAL_REQUESTS)
        ]
    )
    invoices = [i for i in invoices if i.get("status") != "void"]
    active = [p for p in projects if p.get("status") in ("scheduled", "active")]
    revenue = money(sum(D(p.get("amount") or 0) for p in payments))
    outstanding = money(sum(D(i.get("outstanding") or 0) for i in invoices))
    pending_quotes = [q for q in quotes if q.get("status") in ("draft", "sent")]
    return {
        "activeProjects": len(active),
        "pendingQuotations": len(pending_quotes),
        "collections": str(revenue),
        "outstanding": str(outstanding),
        "expenses": str(money(sum(D(e.get("amount") or 0) for e in expenses))),
        "projectsAtRisk": len([p for p in active if int(p.get("completionPercent") or 0) < 50]),
        "pendingChangeOrders": len([c for c in change_orders if c.get("status") == "draft"]),
        "materialRequests": len([m for m in material_requests if m.get("status") == "requested"]),
    }


def gst_summary(store: DocumentStore, org_id: str) -> dict[str, Any]:
    invoices = [i for i in list_org(store, INVOICES, org_id) if i.get("status") != "void"]
    purchases = list_org(store, PURCHASES, org_id)
    output_tax = money(sum(D((i.get("tax") or {}).get("taxTotal") or 0) for i in invoices))
    input_tax = money(sum(D((p.get("tax") or {}).get("taxTotal") or 0) for p in purchases))
    return {"outputTax": str(output_tax), "inputTax": str(input_tax), "net": str(money(output_tax - input_tax))}


def measurement_report(store: DocumentStore, org_id: str) -> dict[str, Any]:
    rows = list_org(store, MEASUREMENTS, org_id)
    by_site: dict[str, dict[str, Any]] = {}
    for m in rows:
        site_id = str(m.get("siteId") or "unassigned")
        bucket = by_site.setdefault(
            site_id,
            {"siteId": site_id if site_id != "unassigned" else None, "count": 0, "items": []},
        )
        bucket["count"] += 1
        bucket["items"].append(
            {
                "id": m.get("id"),
                "title": m.get("title") or m.get("name") or m.get("number"),
                "status": m.get("status"),
                "projectId": m.get("projectId"),
                "updatedAt": m.get("updatedAt") or m.get("createdAt"),
            }
        )
    sites = {s["id"]: s for s in list_org(store, SITES, org_id)}
    for site_id, bucket in by_site.items():
        site = sites.get(site_id) or {}
        bucket["siteName"] = site.get("name") or site.get("address") or site_id
        bucket["customerId"] = site.get("customerId")
    return {"items": list(by_site.values()), "total": len(rows)}


def daily_expenses_report(store: DocumentStore, org_id: str) -> dict[str, Any]:
    expenses = list_org(store, EXPENSES, org_id)
    by_day: dict[str, dict[str, Any]] = {}
    for e in expenses:
        day = str(e.get("date") or (e.get("createdAt") or "")[:10] or "unknown")
        bucket = by_day.setdefault(day, {"date": day, "count": 0, "total": D(0), "items": []})
        amount = D(e.get("amount") or 0)
        bucket["count"] += 1
        bucket["total"] = money(bucket["total"] + amount)
        bucket["items"].append(
            {
                "id": e.get("id"),
                "category": e.get("category"),
                "amount": str(amount),
                "projectId": e.get("projectId"),
                "notes": e.get("notes") or e.get("description"),
            }
        )
    days = sorted(by_day.values(), key=lambda d: d["date"], reverse=True)
    for d in days:
        d["total"] = str(d["total"])
    return {
        "items": days,
        "grandTotal": str(money(sum(D(d["total"]) for d in days))),
    }


def gstr1_report(store: DocumentStore, org_id: str) -> dict[str, Any]:
    """Outward supply list from invoices (filing submission out of scope)."""
    invoices = [i for i in list_org(store, INVOICES, org_id) if i.get("status") not in ("void", "draft")]
    customers = {c["id"]: c for c in list_org(store, CUSTOMERS, org_id)}
    rows = []
    for inv in invoices:
        tax = inv.get("tax") or {}
        cust = customers.get(inv.get("customerId") or "") or {}
        rows.append(
            {
                "id": inv.get("id"),
                "number": inv.get("number"),
                "date": inv.get("invoiceDate") or inv.get("issueDate") or (inv.get("createdAt") or "")[:10],
                "customerName": cust.get("name") or inv.get("customerName"),
                "gstin": cust.get("gstin"),
                "taxableAmount": tax.get("taxableAmount") or inv.get("subtotal") or inv.get("total"),
                "cgst": tax.get("cgst") or "0",
                "sgst": tax.get("sgst") or "0",
                "igst": tax.get("igst") or "0",
                "taxTotal": tax.get("taxTotal") or "0",
                "grandTotal": inv.get("grandTotal") or inv.get("total"),
                "status": inv.get("status"),
            }
        )
    return {"items": rows, "count": len(rows)}


def gstr2b_report(store: DocumentStore, org_id: str) -> dict[str, Any]:
    """Inward supply list from purchases (filing submission out of scope)."""
    purchases = list_org(store, PURCHASES, org_id)
    rows = []
    for p in purchases:
        tax = p.get("tax") or {}
        rows.append(
            {
                "id": p.get("id"),
                "invoiceNumber": p.get("invoiceNumber") or p.get("number"),
                "date": p.get("date") or (p.get("createdAt") or "")[:10],
                "supplier": p.get("supplier") or p.get("supplierName"),
                "supplierId": p.get("supplierId"),
                "taxableAmount": tax.get("taxableAmount") or p.get("subtotal") or p.get("total"),
                "cgst": tax.get("cgst") or "0",
                "sgst": tax.get("sgst") or "0",
                "igst": tax.get("igst") or "0",
                "taxTotal": tax.get("taxTotal") or "0",
                "grandTotal": p.get("total"),
                "status": p.get("status"),
            }
        )
    return {"items": rows, "count": len(rows)}


def project_profitability(store: DocumentStore, org_id: str, project_id: str) -> dict[str, Any]:
    from app.core.repo import org_owned

    from app.billing.labor import labor_lines_from_attendance_and_schedule
    from app.projects.budget import HEADS, expense_head, project_budget

    project = org_owned(store, PROJECTS, project_id, org_id)
    invoices = [
        i
        for i in list_org(store, INVOICES, org_id, extra_filters=[("projectId", "==", project_id)], limit=200)
        if i.get("status") != "void"
    ]
    expenses = list_org(store, EXPENSES, org_id, extra_filters=[("projectId", "==", project_id)], limit=500)
    purchases = list_org(store, PURCHASES, org_id, extra_filters=[("projectId", "==", project_id)], limit=200)
    revenue = money(sum(D(i.get("paid") or 0) for i in invoices))
    billed = money(sum(D(i.get("total") or 0) for i in invoices))

    # Attendance wages (daily rate x days marked) are the project's labour cost.
    wages = money(sum((D(l.get("amount") or 0) for l in labor_lines_from_attendance_and_schedule(store, org_id, project_id)), D(0)))
    spent = {"labour": wages, "material": money(sum(D(p.get("total") or 0) for p in purchases)), "tool": D(0), "other": D(0)}
    line_spent: dict[str, Any] = {}
    for e in expenses:
        amount = D(e.get("amount") or 0)
        head = expense_head(e.get("category"))
        spent[head] = spent[head] + amount
        if e.get("budgetLineId"):
            key = str(e["budgetLineId"])
            line_spent[key] = line_spent.get(key, D(0)) + amount
    labour_cost = money(spent["labour"])
    material_cost = money(spent["material"])
    other_cost = money(spent["tool"] + spent["other"])
    actual_cost = money(labour_cost + material_cost + other_cost)
    estimated_cost = money(project.get("estimatedCost") or 0)

    budget_lines, budget = project_budget(store, project)
    quoted = {"labour": budget.get("workTotal"), "material": budget.get("materialTotal"), "tool": budget.get("toolTotal"), "other": "0"}
    planned = {"labour": budget.get("labourCost"), "material": budget.get("materialCost"), "tool": budget.get("equipmentCost"), "other": budget.get("otherCost")}
    heads = [
        {
            "key": key,
            "label": label,
            "kind": kind,
            "quoted": str(money(D(quoted[key] or 0))),
            "estimatedCost": str(money(D(planned[key] or 0))),
            "spent": str(money(spent[key])),
        }
        for key, label, kind in HEADS
    ]
    lines_out = [{**line, "spent": str(money(line_spent.get(str(line.get("id")), D(0))))} for line in budget_lines]
    contract = money(project.get("contractValue") or 0)
    progress = D(project.get("completionPercent") or 0) / 100
    cost_ratio = (actual_cost / estimated_cost) if estimated_cost else D(0)
    risk = "ok"
    if progress and cost_ratio > progress + D("0.15"):
        risk = "margin_risk"
    return {
        "contractValue": str(contract),
        "estimatedCost": str(estimated_cost),
        "estimatedProfit": str(money(contract - estimated_cost)),
        "actualRevenue": str(revenue),
        "billed": str(billed),
        "actualCost": str(actual_cost),
        "labourCost": str(labour_cost),
        "materialCost": str(material_cost),
        "otherCost": str(other_cost),
        "actualProfit": str(money(revenue - actual_cost)),
        "progress": str(project.get("completionPercent") or 0),
        "risk": risk,
        "attendanceWages": str(wages),
        "toolCost": str(money(spent["tool"])),
        "remainingToBill": str(money(max(contract - billed, D(0)))),
        "approvedChangeOrders": str(money(project.get("approvedChangeOrders") or 0)),
        "heads": heads,
        "budgetLines": lines_out,
    }


def redact_for_customer(doc: dict[str, Any]) -> dict[str, Any]:
    blocked = {
        "estimatedCost",
        "actualCost",
        "profit",
        "margin",
        "internalNotes",
        "costing",
        "computedCost",
    }
    out = {k: v for k, v in doc.items() if k not in blocked}
    if isinstance(out.get("computed"), dict):
        out["computed"] = {k: v for k, v in out["computed"].items() if k in ("selling", "grandTotal", "tax", "subtotal")}
    return out
