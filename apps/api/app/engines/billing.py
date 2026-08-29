from __future__ import annotations

from decimal import Decimal

from app.engines.units import D, money


def assert_billing_cap(
    billed_to_date: Decimal | str | float,
    this_invoice: Decimal | str | float,
    contract_value: Decimal | str | float,
    approved_change_orders: Decimal | str | float,
    override: bool = False,
) -> None:
    cap = money(D(contract_value) + D(approved_change_orders))
    total = money(D(billed_to_date) + D(this_invoice))
    if total > cap and not override:
        raise ValueError(
            f"Billing {total} exceeds approved contract plus change orders {cap}"
        )
