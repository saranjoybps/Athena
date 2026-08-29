from __future__ import annotations

from decimal import Decimal, ROUND_CEILING
from typing import Any

from app.engines.units import D, qty


def procurement_quantity(required: Decimal | str | float, wastage_rate: Decimal | str | float) -> Decimal:
    return qty(D(required) * (Decimal("1") + D(wastage_rate)))


def recommend_packs(quantity: Decimal | str | float, pack_sizes: list[Decimal | str | float]) -> dict[str, Any]:
    remaining = D(quantity)
    sizes = sorted((D(s) for s in pack_sizes), reverse=True)
    if not sizes:
        raise ValueError("pack_sizes required")
    recommendation: list[dict[str, Any]] = []
    for size in sizes:
        if remaining <= 0:
            break
        count = (remaining / size).to_integral_value(rounding=ROUND_CEILING)
        # greedy: take as many full packs that don't overshoot too wildly except last sizes
        count_floor = (remaining / size).to_integral_value()
        if size != sizes[-1]:
            count = count_floor
        if count <= 0:
            continue
        recommendation.append({"size": str(qty(size)), "count": int(count)})
        remaining -= count * size
    if remaining > 0:
        smallest = sizes[-1]
        extra = (remaining / smallest).to_integral_value(rounding=ROUND_CEILING)
        if extra <= 0:
            extra = 1
        found = next((r for r in recommendation if r["size"] == str(qty(smallest))), None)
        if found:
            found["count"] += int(extra)
        else:
            recommendation.append({"size": str(qty(smallest)), "count": int(extra)})
        remaining -= extra * smallest
    total = sum(D(r["size"]) * r["count"] for r in recommendation)
    return {
        "required": str(qty(quantity)),
        "recommendation": recommendation,
        "purchasedQuantity": str(qty(total)),
        "overage": str(qty(total - D(quantity))),
    }
