from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

TWOPLACES = Decimal("0.01")
SIXPLACES = Decimal("0.000001")

# Canonical conversions to SI-ish bases: metre, kg, litre, piece
TO_METRE = {
    "m": Decimal("1"),
    "metre": Decimal("1"),
    "running_metre": Decimal("1"),
    "ft": Decimal("0.3048"),
    "running_ft": Decimal("0.3048"),
    "inch": Decimal("0.0254"),
    "in": Decimal("0.0254"),
}

TO_SQM = {
    "sqm": Decimal("1"),
    "sq.m.": Decimal("1"),
    "sq_m": Decimal("1"),
    "sqft": Decimal("0.09290304"),
    "sq.ft.": Decimal("0.09290304"),
    "sq_ft": Decimal("0.09290304"),
}

TO_CUM = {
    "cum": Decimal("1"),
    "cubic_m": Decimal("1"),
    "cft": Decimal("0.028316846592"),
    "cubic_ft": Decimal("0.028316846592"),
}

TO_KG = {
    "kg": Decimal("1"),
    "g": Decimal("0.001"),
    "grams": Decimal("0.001"),
}

TO_LITRE = {
    "l": Decimal("1"),
    "litre": Decimal("1"),
    "litres": Decimal("1"),
}

COUNT_UNITS = {
    "pcs",
    "pieces",
    "bags",
    "boxes",
    "rolls",
    "sheets",
    "bundles",
}


def D(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value))


def money(value: Decimal | int | float | str) -> Decimal:
    return D(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def qty(value: Decimal | int | float | str) -> Decimal:
    return D(value).quantize(SIXPLACES, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Measured:
    value: Decimal
    unit: str
    original_value: Decimal
    original_unit: str


def normalize_unit(unit: str) -> str:
    u = unit.strip().lower().replace(" ", "_")
    aliases = {
        "sq.ft": "sqft",
        "sqft.": "sqft",
        "sft": "sqft",
        "sq.m": "sqm",
        "sqm.": "sqm",
        "running_ft.": "running_ft",
        "rft": "running_ft",
        "rmt": "running_metre",
        "cft.": "cft",
        "cu.ft": "cft",
        "cu.m": "cum",
    }
    return aliases.get(u, u)


def convert(value: Decimal | int | float | str, from_unit: str, to_unit: str) -> Measured:
    src = normalize_unit(from_unit)
    dst = normalize_unit(to_unit)
    amount = D(value)
    if src == dst:
        return Measured(qty(amount), dst, amount, src)

    tables = (TO_METRE, TO_SQM, TO_CUM, TO_KG, TO_LITRE)
    for table in tables:
        if src in table and dst in table:
            canonical = amount * table[src]
            converted = canonical / table[dst]
            return Measured(qty(converted), dst, amount, src)

    if src in COUNT_UNITS and dst in COUNT_UNITS:
        raise ValueError(f"Cannot convert count unit {src} to {dst}")
    raise ValueError(f"Unsupported conversion {src} -> {dst}")


def preserve(value: Decimal | int | float | str, unit: str) -> Measured:
    u = normalize_unit(unit)
    amount = D(value)
    return Measured(qty(amount), u, amount, u)
