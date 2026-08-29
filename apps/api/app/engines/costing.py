from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.units import D, money


def apply_markup(cost: Decimal | str | float, markup_rate: Decimal | str | float) -> dict[str, Any]:
    """Selling = cost * (1 + markup). Markup is on cost."""
    c = D(cost)
    m = D(markup_rate)
    selling = money(c * (Decimal("1") + m))
    profit = money(selling - c)
    margin = (profit / selling) if selling else Decimal("0")
    return {
        "cost": str(money(c)),
        "markupRate": str(m),
        "selling": str(selling),
        "profit": str(profit),
        "marginRate": str(margin),
        "method": "markup",
    }


def apply_margin(cost: Decimal | str | float, margin_rate: Decimal | str | float) -> dict[str, Any]:
    """Selling = cost / (1 - margin). Margin is on selling price."""
    c = D(cost)
    m = D(margin_rate)
    if m >= 1:
        raise ValueError("margin must be < 1")
    selling = money(c / (Decimal("1") - m))
    profit = money(selling - c)
    return {
        "cost": str(money(c)),
        "marginRate": str(m),
        "selling": str(selling),
        "profit": str(profit),
        "markupRate": str((selling - c) / c if c else Decimal("0")),
        "method": "margin",
    }


def estimate_totals(
    material: Decimal | str | float = 0,
    labour: Decimal | str | float = 0,
    equipment: Decimal | str | float = 0,
    transport: Decimal | str | float = 0,
    subcontractor: Decimal | str | float = 0,
    other: Decimal | str | float = 0,
    markup_rate: Decimal | str | float | None = None,
    margin_rate: Decimal | str | float | None = None,
    discount: Decimal | str | float = 0,
) -> dict[str, Any]:
    cost = money(
        D(material) + D(labour) + D(equipment) + D(transport) + D(subcontractor) + D(other)
    )
    if markup_rate is not None and margin_rate is not None:
        raise ValueError("Provide markup or margin, not both")
    if markup_rate is not None:
        priced = apply_markup(cost, markup_rate)
    elif margin_rate is not None:
        priced = apply_margin(cost, margin_rate)
    else:
        priced = apply_markup(cost, 0)
    selling = D(priced["selling"])
    disc = money(discount)
    after_discount = money(selling - disc)
    return {
        "materialCost": str(money(material)),
        "labourCost": str(money(labour)),
        "equipmentCost": str(money(equipment)),
        "transportCost": str(money(transport)),
        "subcontractorCost": str(money(subcontractor)),
        "otherCost": str(money(other)),
        "totalCost": str(cost),
        "discount": str(disc),
        "subtotal": str(after_discount),
        **priced,
        "sellingBeforeDiscount": priced["selling"],
        "selling": str(after_discount),
        "profit": str(money(after_discount - cost)),
    }
