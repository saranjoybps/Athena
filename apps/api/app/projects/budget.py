"""Project budget = the approved estimate, snapshotted when the project starts.

Each estimate line becomes a budget line (what the customer pays for it, and its internal cost).
Expenses, purchases and attendance wages are booked against cost heads that match the estimate's
line kinds, so the project can show "quoted vs spent" per head and per line.
"""

from __future__ import annotations

from typing import Any

from app.core.collections import ESTIMATES, QUOTES
from app.core.store import DocumentStore
from app.engines.units import D, money

# Cost head -> estimate line kind it is measured against.
HEADS: tuple[tuple[str, str, str], ...] = (
    ("labour", "Labour & work", "work"),
    ("material", "Materials", "material"),
    ("tool", "Tools & equipment", "tool"),
    ("other", "Site expenses (food, transport, other)", ""),
)

EXPENSE_CATEGORIES = ("food", "transport", "material", "tool", "labour", "subcontractor", "other")


def expense_head(category: Any) -> str:
    """Map a free-text expense category onto a cost head."""
    key = str(category or "").strip().lower()
    if key.startswith(("labour", "labor", "wage", "subcontract", "work")):
        return "labour"
    if key.startswith("material"):
        return "material"
    if key.startswith(("tool", "equipment", "rental", "hire")):
        return "tool"
    return "other"


def _line_cost(item: dict[str, Any]) -> Any:
    if item.get("cost") not in (None, ""):
        return money(D(item["cost"]))
    return money(sum((D(item.get(f) or 0) for f in ("materialCost", "labourCost", "equipmentCost", "otherCost")), D(0)))


def budget_lines_from_items(items: list[Any]) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for index, item in enumerate(items or []):
        if not isinstance(item, dict):
            continue
        qty = D(item.get("quantity") or 0)
        if item.get("amount") not in (None, ""):
            amount = money(D(item["amount"]))
        elif item.get("rate") not in (None, ""):
            amount = money(qty * D(item["rate"]))
        else:
            amount = _line_cost(item)
        kind = item.get("kind") if item.get("kind") in ("work", "material", "tool") else "work"
        lines.append(
            {
                "id": f"L{index + 1}",
                "kind": kind,
                "description": str(item.get("description") or f"Line {index + 1}"),
                "quantity": str(item.get("quantity") or "0"),
                "unit": str(item.get("unit") or ""),
                "rate": str(item.get("unitPrice") or item.get("rate") or ""),
                "amount": str(amount),
                "cost": str(_line_cost(item)),
            }
        )
    return lines


def budget_totals(computed: dict[str, Any]) -> dict[str, str]:
    return {
        "workTotal": str(computed.get("workTotal") or "0"),
        "materialTotal": str(computed.get("materialTotal") or "0"),
        "toolTotal": str(computed.get("toolTotal") or "0"),
        "labourCost": str(computed.get("labourCost") or "0"),
        "materialCost": str(computed.get("materialCost") or "0"),
        "equipmentCost": str(computed.get("equipmentCost") or "0"),
        "otherCost": str(
            money(D(computed.get("otherCost") or 0) + D(computed.get("transportCost") or 0) + D(computed.get("subcontractorCost") or 0))
        ),
    }


def project_budget(store: DocumentStore, project: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Budget lines for projects started before the snapshot existed are rebuilt from the estimate."""
    if project.get("budgetLines") is not None:
        return list(project.get("budgetLines") or []), dict(project.get("budget") or {})
    source: dict[str, Any] = {}
    if project.get("estimateId"):
        source = store.get(ESTIMATES, str(project["estimateId"])) or {}
    if not source.get("items") and project.get("quoteId"):
        source = store.get(QUOTES, str(project["quoteId"])) or {}
    return budget_lines_from_items(source.get("items") or []), budget_totals(source.get("computed") or {})
