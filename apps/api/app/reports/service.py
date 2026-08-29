from __future__ import annotations

from typing import Any

from app.core.collections import (
    ACCOUNTING_ENTRIES,
    CHANGE_ORDERS,
    CUSTOMERS,
    EXPENSES,
    INVOICES,
    MATERIAL_REQUESTS,
    PAYMENTS,
    PROJECTS,
    PURCHASES,
    QUOTES,
    SNAGS,
)
from app.core.repo import list_org
from app.core.store import DocumentStore
from app.engines.units import D, money


def owner_dashboard(store: DocumentStore, org_id: str) -> dict[str, Any]:
    projects = list_org(store, PROJECTS, org_id)
    quotes = list_org(store, QUOTES, org_id)
    invoices = list_org(store, INVOICES, org_id)
    payments = list_org(store, PAYMENTS, org_id)
    expenses = list_org(store, EXPENSES, org_id)
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
        "pendingChangeOrders": len([c for c in list_org(store, CHANGE_ORDERS, org_id) if c.get("status") == "draft"]),
        "materialRequests": len([m for m in list_org(store, MATERIAL_REQUESTS, org_id) if m.get("status") == "requested"]),
    }


def gst_summary(store: DocumentStore, org_id: str) -> dict[str, Any]:
    invoices = list_org(store, INVOICES, org_id)
    purchases = list_org(store, PURCHASES, org_id)
    output_tax = money(sum(D((i.get("tax") or {}).get("taxTotal") or 0) for i in invoices))
    input_tax = money(sum(D((p.get("tax") or {}).get("taxTotal") or 0) for p in purchases))
    return {"outputTax": str(output_tax), "inputTax": str(input_tax), "net": str(money(output_tax - input_tax))}


def project_profitability(store: DocumentStore, org_id: str, project_id: str) -> dict[str, Any]:
    from app.core.repo import org_owned

    project = org_owned(store, PROJECTS, project_id, org_id)
    invoices = [i for i in list_org(store, INVOICES, org_id) if i.get("projectId") == project_id]
    expenses = [e for e in list_org(store, EXPENSES, org_id) if e.get("projectId") == project_id]
    purchases = [p for p in list_org(store, PURCHASES, org_id) if p.get("projectId") == project_id]
    revenue = money(sum(D(i.get("paid") or 0) for i in invoices))
    billed = money(sum(D(i.get("total") or 0) for i in invoices))
    labour_cost = money(sum(D(e.get("amount") or 0) for e in expenses if e.get("category") == "labour"))
    material_cost = money(sum(D(p.get("total") or 0) for p in purchases))
    other_cost = money(sum(D(e.get("amount") or 0) for e in expenses if e.get("category") != "labour"))
    actual_cost = money(labour_cost + material_cost + other_cost)
    estimated_cost = money(project.get("estimatedCost") or 0)
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
