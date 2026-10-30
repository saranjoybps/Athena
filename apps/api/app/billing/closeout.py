"""Final billing review.

The estimate stays a forecast. Customer charges follow agreed rates and billable flags.
Actual wages, material purchases and tool rentals are costs even when they are not billed.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.units import D, money


def _dec(value: Any) -> Decimal:
    try:
        return D(value if value not in (None, "") else 0)
    except Exception:
        return D(0)


def _is_fixed(line: dict[str, Any]) -> bool:
    return str(line.get("billingMethod") or "") == "fixed" or str(line.get("unit") or "") == "job"


def _work_lines(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [line for line in lines if line.get("kind") in ("work", "other") or line.get("billingMethod")]


def suggest_billable_lines(
    lines: list[dict[str, Any]],
    completed: dict[str, Decimal],
    invoiced_qty: dict[str, Decimal],
    expenses: list[dict[str, Any]],
    invoiced_expense_ids: set[str],
    variations: list[dict[str, Any]],
    invoiced_variation_ids: set[str],
) -> list[dict[str, Any]]:
    """Remaining customer charges. Does not include unpaid scheduled wages or non-billable costs."""
    suggested: list[dict[str, Any]] = []
    for line in _work_lines(lines):
        if line.get("kind") not in ("work", "other", None) and not line.get("billingMethod"):
            continue
        if line.get("kind") in ("material", "tool"):
            continue
        line_id = str(line.get("id") or "")
        rate = _dec(line.get("rate") or line.get("unitPrice"))
        approved = _dec(line.get("quantity"))
        if _is_fixed(line):
            already = invoiced_qty.get(line_id, D(0))
            if already > 0:
                continue
            amount = money(_dec(line.get("amount") or rate))
            suggested.append(
                {
                    "sourceLineId": line_id,
                    "description": str(line.get("description") or "Fixed scope"),
                    "quantity": "1",
                    "unit": "job",
                    "rate": str(amount),
                    "amount": str(amount),
                    "billingMethod": "fixed",
                    "kind": "work",
                }
            )
            continue
        done = completed.get(line_id, D(0))
        billable = min(done, approved) if approved else done
        remaining = billable - invoiced_qty.get(line_id, D(0))
        if remaining <= 0:
            continue
        amount = money(remaining * rate)
        suggested.append(
            {
                "sourceLineId": line_id,
                "description": str(line.get("description") or "Work"),
                "quantity": format(remaining.normalize(), "f"),
                "unit": str(line.get("unit") or ""),
                "rate": str(money(rate)),
                "amount": str(amount),
                "billingMethod": str(line.get("billingMethod") or ""),
                "kind": str(line.get("kind") or "work"),
            }
        )
    for expense in expenses:
        if not expense.get("billableToCustomer"):
            continue
        expense_id = str(expense.get("id") or "")
        if not expense_id or expense_id in invoiced_expense_ids:
            continue
        amount = money(_dec(expense.get("amount")))
        if amount <= 0:
            continue
        suggested.append(
            {
                "expenseId": expense_id,
                "description": str(expense.get("description") or expense.get("category") or "Billable cost"),
                "quantity": "1",
                "unit": str(expense.get("category") or "charge"),
                "rate": str(amount),
                "amount": str(amount),
                "kind": str(expense.get("category") or "other"),
            }
        )
    for variation in variations:
        if str(variation.get("status") or "") != "approved":
            continue
        variation_id = str(variation.get("id") or "")
        if not variation_id or variation_id in invoiced_variation_ids:
            continue
        amount = money(_dec(variation.get("sellingPrice")))
        if amount <= 0:
            continue
        suggested.append(
            {
                "changeOrderId": variation_id,
                "description": f"Approved variation — {variation.get('reason') or variation.get('number') or 'extra work'}",
                "quantity": "1",
                "unit": "variation",
                "rate": str(amount),
                "amount": str(amount),
                "kind": "variation",
            }
        )
    return suggested


def financial_summary(
    *,
    original_estimate: Decimal,
    agreed_value: Decimal,
    variations_total: Decimal,
    labour_revenue: Decimal,
    wages: Decimal,
    material_cost: Decimal,
    tool_cost: Decimal,
    other_cost: Decimal,
    invoiced: Decimal,
    collected: Decimal,
) -> dict[str, str]:
    actual_cost = money(wages + material_cost + tool_cost + other_cost)
    recognized = money(invoiced if invoiced else labour_revenue)
    return {
        "originalEstimate": str(money(original_estimate)),
        "approvedVariations": str(money(variations_total)),
        "agreedProjectValue": str(money(agreed_value)),
        "labourRevenue": str(money(labour_revenue)),
        "actualLabourCost": str(money(wages)),
        "labourMargin": str(money(labour_revenue - wages)),
        "actualMaterialCost": str(money(material_cost)),
        "actualToolCost": str(money(tool_cost)),
        "actualOtherCost": str(money(other_cost)),
        "actualCost": str(actual_cost),
        "invoiced": str(money(invoiced)),
        "collected": str(money(collected)),
        "balanceDue": str(money(invoiced - collected)),
        "accountingProfit": str(money(recognized - actual_cost)),
        "accountingBasis": "Invoiced amount minus actual recorded costs. Estimated totals and unpaid scheduled wages are not costs.",
        "cashResult": str(money(collected - actual_cost)),
        "cashBasis": "Cash collected minus recorded expenses and wages. This is not accounting profit.",
    }


def invoiced_index(invoices: list[dict[str, Any]]) -> tuple[dict[str, Decimal], set[str], set[str]]:
    qty: dict[str, Decimal] = {}
    expenses: set[str] = set()
    variations: set[str] = set()
    for invoice in invoices:
        if invoice.get("status") == "void" or invoice.get("deletedAt"):
            continue
        for item in invoice.get("items") or []:
            if not isinstance(item, dict):
                continue
            line_id = str(item.get("sourceLineId") or "")
            if line_id:
                qty[line_id] = qty.get(line_id, D(0)) + _dec(item.get("quantity"))
            if item.get("expenseId"):
                expenses.add(str(item["expenseId"]))
            if item.get("changeOrderId"):
                variations.add(str(item["changeOrderId"]))
    return qty, expenses, variations


def project_billing_review(store, org_id: str, project_id: str) -> dict[str, Any]:
    from app.billing.labor import labor_lines_from_attendance_and_schedule
    from app.core.collections import ATTENDANCE, CHANGE_ORDERS, ESTIMATES, EXPENSES, INVOICES, PAYMENTS, PROJECTS
    from app.core.repo import list_org, org_owned
    from app.projects.budget import expense_head, project_budget

    project = org_owned(store, PROJECTS, project_id, org_id)
    lines, budget = project_budget(store, project)
    estimate = store.get(ESTIMATES, str(project.get("estimateId") or "")) if project.get("estimateId") else {}
    original = _dec((estimate or {}).get("computed", {}).get("selling") or project.get("contractValue") or 0)
    variations = [
        row
        for row in list_org(store, CHANGE_ORDERS, org_id, extra_filters=[("projectId", "==", project_id)], limit=100)
        if not row.get("deletedAt")
    ]
    approved_variations = [row for row in variations if row.get("status") == "approved"]
    variation_total = money(sum((_dec(row.get("sellingPrice")) for row in approved_variations), D(0)))
    invoices = [
        row
        for row in list_org(store, INVOICES, org_id, extra_filters=[("projectId", "==", project_id)], limit=100)
        if row.get("status") != "void" and not row.get("deletedAt")
    ]
    payments = [
        row
        for row in list_org(store, PAYMENTS, org_id, extra_filters=[("projectId", "==", project_id)], limit=200)
        if not row.get("deletedAt")
    ]
    expenses = [
        row
        for row in list_org(store, EXPENSES, org_id, extra_filters=[("projectId", "==", project_id)], limit=500)
        if not row.get("deletedAt")
    ]
    attendance = [
        row
        for row in store.query(ATTENDANCE, filters=[("orgId", "==", org_id), ("projectId", "==", project_id)], limit=2000)
        if not row.get("deletedAt")
    ]
    completed: dict[str, Decimal] = {}
    for row in attendance:
        for item in row.get("workDone") or []:
            if isinstance(item, dict) and item.get("lineId"):
                key = str(item["lineId"])
                completed[key] = completed.get(key, D(0)) + _dec(item.get("quantity"))
    invoiced_qty, invoiced_expenses, invoiced_variations = invoiced_index(invoices)
    suggested = suggest_billable_lines(lines, completed, invoiced_qty, expenses, invoiced_expenses, approved_variations, invoiced_variations)
    wages = money(sum((_dec(row.get("amount")) for row in labor_lines_from_attendance_and_schedule(store, org_id, project_id)), D(0)))
    spent = {"material": D(0), "tool": D(0), "other": D(0), "labour": D(0)}
    for expense in expenses:
        head = expense_head(expense.get("category"))
        if head == "labour":
            wages = money(wages + _dec(expense.get("amount")))
            continue
        spent[head] = spent.get(head, D(0)) + _dec(expense.get("amount"))
    labour_revenue = money(
        sum((_dec(item.get("amount")) for item in suggested if item.get("sourceLineId")), D(0))
        + sum(
            (
                _dec(item.get("amount"))
                for invoice in invoices
                for item in (invoice.get("items") or [])
                if isinstance(item, dict) and item.get("sourceLineId")
            ),
            D(0),
        )
    )
    invoiced_total = money(sum((_dec(row.get("total")) for row in invoices), D(0)))
    collected = money(sum((_dec(row.get("amount")) for row in payments), D(0)))
    summary = financial_summary(
        original_estimate=original,
        agreed_value=_dec(project.get("contractValue") or original + variation_total),
        variations_total=variation_total,
        labour_revenue=labour_revenue,
        wages=wages,
        material_cost=spent["material"],
        tool_cost=spent["tool"],
        other_cost=spent["other"],
        invoiced=invoiced_total,
        collected=collected,
    )
    return {
        "projectId": project_id,
        "estimateId": project.get("estimateId"),
        "quoteId": project.get("quoteId"),
        "workCompleted": {key: format(value.normalize(), "f") for key, value in completed.items()},
        "suggestedLines": suggested,
        "suggestedTotal": str(money(sum((_dec(item["amount"]) for item in suggested), D(0)))),
        "budget": budget,
        "summary": summary,
        "note": "Suggested lines bill agreed work and costs marked billable to the customer. Other expenses stay as project cost only.",
    }


def guard_duplicate_lines(items: list[dict[str, Any]], invoices: list[dict[str, Any]], approved: dict[str, Decimal]) -> None:
    from app.core.errors import AppError

    qty, expenses, variations = invoiced_index(invoices)
    for item in items:
        line_id = str(item.get("sourceLineId") or "")
        if line_id:
            cap = approved.get(line_id)
            adding = _dec(item.get("quantity"))
            if cap is not None and qty.get(line_id, D(0)) + adding > cap:
                raise AppError(409, "already_billed", "This quantity is already on an invoice. Bill only what is still unbilled.")
        expense_id = str(item.get("expenseId") or "")
        if expense_id and expense_id in expenses:
            raise AppError(409, "already_billed", "That expense is already on an invoice.")
        variation_id = str(item.get("changeOrderId") or "")
        if variation_id and variation_id in variations:
            raise AppError(409, "already_billed", "That variation is already on an invoice.")
