"""Customer invoice amounts. Attendance wages are never a customer charge."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.units import D, money


def _dec(value: Any) -> Decimal:
    try:
        return D(value if value not in (None, "") else 0)
    except Exception:
        return D(0)


def charge_group(line: dict[str, Any]) -> str:
    kind = str(line.get("kind") or "").lower()
    method = str(line.get("billingMethod") or "").lower()
    category = str(line.get("category") or "").lower()
    if kind == "material" or category.startswith("material"):
        return "material"
    if kind == "tool" or category.startswith("tool") or category.startswith("equipment"):
        return "tool"
    if kind in ("work", "labour", "labor") or method in ("area", "quantity", "length", "time", "fixed") or category.startswith("labour"):
        return "labour"
    return "other"


def _line_amount(line: dict[str, Any]) -> Decimal:
    if line.get("amount") not in (None, ""):
        return money(_dec(line.get("amount")))
    return money(_dec(line.get("quantity")) * _dec(line.get("rate")))


def build_customer_invoice(
    estimate_lines: list[dict[str, Any]],
    *,
    labour_mode: str = "estimate",
    completed: dict[str, Any] | None = None,
    billable_expenses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Replace a group with actual billable figures. Never add wages, and never add estimate plus actual."""
    done = {str(key): _dec(value) for key, value in (completed or {}).items()}
    expenses = list(billable_expenses or [])
    grouped: dict[str, list[dict[str, Any]]] = {"labour": [], "material": [], "tool": [], "other": []}

    for raw in estimate_lines:
        group = charge_group(raw)
        line = {
            "description": str(raw.get("description") or "Charge"),
            "quantity": str(raw.get("quantity") or "0"),
            "unit": str(raw.get("unit") or ""),
            "rate": str(money(_dec(raw.get("rate") or raw.get("unitPrice")))),
            "amount": str(_line_amount(raw)),
            "kind": group,
            "sourceLineId": str(raw.get("id") or raw.get("sourceLineId") or ""),
            "billingMethod": str(raw.get("billingMethod") or ""),
        }
        if group == "labour" and labour_mode == "actual" and line["billingMethod"] != "fixed" and line["unit"] != "job":
            quantity = done.get(line["sourceLineId"], _dec(0))
            rate = _dec(line["rate"])
            line["quantity"] = format(quantity.normalize(), "f")
            line["amount"] = str(money(quantity * rate))
        grouped[group].append(line)

    for group, prefix in (("material", "material"), ("tool", "tool")):
        actual = [row for row in expenses if str(row.get("category") or "").lower().startswith(prefix)]
        if not actual:
            continue
        grouped[group] = [
            {
                "description": str(row.get("description") or row.get("category") or group),
                "quantity": "1",
                "unit": group,
                "rate": str(money(_dec(row.get("amount")))),
                "amount": str(money(_dec(row.get("amount")))),
                "kind": group,
                "expenseId": str(row.get("id") or ""),
            }
            for row in actual
            if _dec(row.get("amount")) > 0
        ]

    other_actual = [
        row
        for row in expenses
        if not str(row.get("category") or "").lower().startswith(("material", "tool", "equipment", "labour", "labor", "wage"))
    ]
    if other_actual:
        grouped["other"] = [
            {
                "description": str(row.get("description") or row.get("category") or "Other charge"),
                "quantity": "1",
                "unit": "charge",
                "rate": str(money(_dec(row.get("amount")))),
                "amount": str(money(_dec(row.get("amount")))),
                "kind": "other",
                "expenseId": str(row.get("id") or ""),
            }
            for row in other_actual
        ]

    lines = [line for group in ("labour", "material", "tool", "other") for line in grouped[group]]
    totals = {group: money(sum((_dec(line["amount"]) for line in grouped[group]), D(0))) for group in grouped}
    subtotal = money(sum(totals.values(), D(0)))
    return {
        "lines": lines,
        "labour": str(totals["labour"]),
        "materials": str(totals["material"]),
        "tools": str(totals["tool"]),
        "other": str(totals["other"]),
        "subtotal": str(subtotal),
        "wagesIncluded": "0.00",
    }
