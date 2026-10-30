"""Single source of truth for estimate line amounts and totals.

Every line is priced once here and the amount is stored on the line, so the estimate total,
the PDF, the linked quote, the project contract value and invoices all add up to the same figure.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from app.core.errors import AppError
from app.engines.gst import compute_gst
from app.engines.units import D, money
from app.estimating.schemas import EstimateIn, EstimateItemIn

_COST_FIELDS = ("materialCost", "labourCost", "equipmentCost", "otherCost")


def _num(raw: Any, *, field: str, line: int) -> Decimal:
    try:
        value = D(raw if raw not in (None, "") else 0)
    except (InvalidOperation, ValueError):
        raise AppError(422, "invalid_number", f"Line {line}: {field} must be a number.") from None
    if value.is_nan() or value < 0:
        raise AppError(422, "invalid_number", f"Line {line}: {field} can't be negative.")
    return value


def _price_factor(payload: EstimateIn) -> tuple[Decimal, str]:
    """Cost-plus pricing for lines without a customer rate (older estimates)."""
    if payload.markupRate not in (None, "") and payload.marginRate not in (None, ""):
        raise AppError(422, "pricing_conflict", "Use either a markup or a margin, not both.")
    if payload.marginRate not in (None, ""):
        margin = D(payload.marginRate)
        if margin >= 1:
            raise AppError(422, "invalid_margin", "Margin must be below 100%.")
        return Decimal("1") / (Decimal("1") - margin), "margin"
    if payload.markupRate not in (None, ""):
        return Decimal("1") + D(payload.markupRate), "markup"
    return Decimal("1"), "rate"


def price_line(item: EstimateItemIn, index: int, factor: Decimal) -> dict[str, Any]:
    line_no = index + 1
    if not item.description.strip():
        raise AppError(422, "line_description_required", f"Line {line_no}: add a description.")
    quantity = _num(item.quantity, field="quantity", line=line_no)
    if item.kind == "tool" and item.toolUnits not in (None, "") and item.days not in (None, ""):
        units = _num(item.toolUnits, field="units", line=line_no)
        days = _num(item.days, field="days", line=line_no)
        if units <= 0 or days <= 0:
            raise AppError(422, "invalid_quantity", f"Line {line_no}: units and days must be more than 0.")
        quantity = units * days
    if quantity <= 0:
        raise AppError(422, "invalid_quantity", f"Line {line_no}: quantity must be more than 0.")
    costs = {f: money(_num(getattr(item, f), field=f, line=line_no)) for f in _COST_FIELDS}
    line_cost = money(sum(costs.values(), Decimal("0")))
    category_kind = {"labour": "work", "materials": "material", "tools": "tool", "other": "other"}.get(item.category or "")
    kind = category_kind or item.kind
    fixed = item.billingMethod == "fixed" and not item.priceByQuantity
    if item.rate not in (None, ""):
        unit_price = money(_num(item.rate, field="rate", line=line_no))
        amount = money(unit_price if fixed else quantity * unit_price)
    else:
        amount = money(line_cost * factor)
        unit_price = money(amount / quantity)
    return {
        **item.model_dump(),
        "description": item.description.strip(),
        **{f: str(v) for f, v in costs.items()},
        "kind": kind,
        "quantity": "1" if fixed else format(quantity.normalize(), "f"),
        "unitPrice": str(unit_price),
        "amount": str(amount),
        "cost": str(line_cost),
    }


def compute_estimate(payload: EstimateIn) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not payload.items:
        raise AppError(422, "estimate_items_required", "Add at least one line to the estimate.")
    factor, method = _price_factor(payload)
    lines = [price_line(item, i, factor) for i, item in enumerate(payload.items)]

    by_kind = {"work": Decimal("0"), "material": Decimal("0"), "tool": Decimal("0"), "other": Decimal("0")}
    for line in lines:
        by_kind[line.get("kind") or "work"] = by_kind.get(line.get("kind") or "work", Decimal("0")) + D(line["amount"])
    selling_before = money(sum((D(l["amount"]) for l in lines), Decimal("0")))
    try:
        discount = money(payload.discount or 0)
    except (InvalidOperation, ValueError):
        raise AppError(422, "invalid_discount", "Discount must be a number.") from None
    if discount < 0 or discount > selling_before:
        raise AppError(422, "invalid_discount", "Discount must be between 0 and the estimate subtotal.")
    selling = money(selling_before - discount)

    def total(field: str) -> Decimal:
        return money(sum((D(l[field]) for l in lines), Decimal("0")))

    material, labour = total("materialCost"), total("labourCost")
    equipment = money(total("equipmentCost") + D(payload.equipmentCost or 0))
    other = money(total("otherCost") + D(payload.otherCost or 0))
    transport, subcontractor = money(payload.transportCost or 0), money(payload.subcontractorCost or 0)
    total_cost = money(material + labour + equipment + other + transport + subcontractor)
    tax = compute_gst(selling, payload.taxRate or "0", payload.placeOfSupply, payload.supplierState, payload.registeredCustomer)
    profit = money(selling - total_cost)
    computed = {
        "method": method,
        "materialCost": str(material),
        "labourCost": str(labour),
        "equipmentCost": str(equipment),
        "transportCost": str(transport),
        "subcontractorCost": str(subcontractor),
        "otherCost": str(other),
        "totalCost": str(total_cost),
        "workTotal": str(money(by_kind["work"])),
        "materialTotal": str(money(by_kind["material"])),
        "toolTotal": str(money(by_kind["tool"])),
        "otherTotal": str(money(by_kind["other"])),
        "sellingBeforeDiscount": str(selling_before),
        "discount": str(discount),
        "subtotal": str(selling),
        "selling": str(selling),
        "profit": str(profit),
        "marginRate": str((profit / selling).quantize(Decimal("0.0001"))) if selling else "0",
        "tax": tax,
        "grandTotal": tax["grandTotal"],
    }
    return computed, lines
