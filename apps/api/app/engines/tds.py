from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.units import D, money


def compute_tds(gross: Decimal | str | float, rate: Decimal | str | float) -> dict[str, Any]:
    g = money(gross)
    r = D(rate)
    tds = money(g * r)
    return {
        "grossAmount": str(g),
        "tdsRate": str(r),
        "tdsAmount": str(tds),
        "netPayable": str(money(g - tds)),
    }
