from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.units import D, money


def compute_gst(
    taxable: Decimal | str | float,
    rate: Decimal | str | float,
    place_of_supply_state: str | None,
    supplier_state: str | None,
    registered_customer: bool = True,
) -> dict[str, Any]:
    amount = money(taxable)
    r = D(rate)
    tax = money(amount * r)
    place = (place_of_supply_state or "Tamil Nadu").strip()
    supplier = (supplier_state or place).strip()
    intra = place.lower() == supplier.lower()
    if intra:
        half = money(tax / 2)
        cgst, sgst, igst = half, money(tax - half), money(0)
    else:
        cgst, sgst, igst = money(0), money(0), tax
    return {
        "taxableAmount": str(amount),
        "rate": str(r),
        "cgst": str(cgst),
        "sgst": str(sgst),
        "igst": str(igst),
        "taxTotal": str(money(cgst + sgst + igst)),
        "grandTotal": str(money(amount + cgst + sgst + igst)),
        "registeredCustomer": registered_customer,
        "placeOfSupply": place,
        "supplierState": supplier,
    }


def round_off(amount: Decimal | str | float) -> dict[str, Any]:
    a = D(amount)
    rounded = money(a.quantize(Decimal("1")))
    return {"amount": str(money(a)), "rounded": str(rounded), "roundOff": str(money(rounded - a))}
