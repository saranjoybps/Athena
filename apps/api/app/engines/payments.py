from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.units import D, money


def allocate(amount: Decimal | str | float, outstanding: Decimal | str | float) -> dict[str, Any]:
    pay = money(amount)
    due = money(outstanding)
    if pay <= 0:
        raise ValueError("Payment amount must be positive")
    if pay > due:
        raise ValueError("Payment cannot exceed outstanding balance")
    remaining = money(due - pay)
    return {
        "allocated": str(pay),
        "previousOutstanding": str(due),
        "outstanding": str(remaining),
        "fullyPaid": remaining == 0,
    }
