"""Authoritative quantities for the five job measurement types.

Area, quantity, length, time and fixed scope are calculated here so issued
estimates can snapshot the result. Later edits recompute the measurement only.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from app.core.errors import AppError
from app.engines.units import D, qty

SCOPE_TYPES = ("area", "quantity", "length", "time", "fixed")

_LENGTH_UNITS = {"ft", "rft", "m", "rmt"}
_TIME_UNITS = {"hour": "hours", "hours": "hours", "day": "days", "days": "days"}


def _num(value: Any, *, label: str) -> Decimal:
    try:
        number = D(value if value not in (None, "") else 0)
    except (InvalidOperation, ValueError):
        raise AppError(422, "invalid_dimension", f"{label} must be a number.") from None
    if number.is_nan() or number < 0:
        raise AppError(422, "invalid_dimension", f"{label} can't be negative.")
    return number


def _fmt(value: Decimal) -> str:
    text = format(value.normalize(), "f")
    return text or "0"


def _openings(raw: Any) -> tuple[Decimal, str]:
    if not raw:
        return Decimal("0"), ""
    if not isinstance(raw, list):
        raise AppError(422, "invalid_openings", "Openings must be a list of width, height and count.")
    total = Decimal("0")
    parts: list[str] = []
    for index, opening in enumerate(raw, start=1):
        if not isinstance(opening, dict):
            raise AppError(422, "invalid_openings", f"Opening {index} is incomplete.")
        width = _num(opening.get("width") if opening.get("width") not in (None, "") else opening.get("length"), label=f"Opening {index} width")
        height = _num(opening.get("height"), label=f"Opening {index} height")
        count = _num(opening.get("count") or opening.get("nos") or 1, label=f"Opening {index} count")
        if count == 0:
            count = Decimal("1")
        area = width * height * count
        total += area
        parts.append(f"{_fmt(count)} × {_fmt(width)} × {_fmt(height)} = {_fmt(area)}")
    detail = " + ".join(parts)
    return total, detail


def _area(inputs: dict[str, Any]) -> dict[str, Any]:
    surface = str(inputs.get("surface") or inputs.get("surfaceType") or "walls").strip().lower()
    surfaces = inputs.get("surfaces")
    gross = Decimal("0")
    bits: list[str] = []
    if isinstance(surfaces, list) and surfaces:
        for index, row in enumerate(surfaces, start=1):
            if not isinstance(row, dict):
                raise AppError(422, "invalid_surface", f"Surface {index} is incomplete.")
            kind = str(row.get("surface") or row.get("type") or "custom").lower()
            count = _num(row.get("count") or 1, label=f"Surface {index} count") or Decimal("1")
            if kind in ("floor", "ceiling", "plan"):
                part = _num(row.get("length"), label=f"Surface {index} length") * _num(row.get("width"), label=f"Surface {index} width")
                bits.append(f"{kind} {_fmt(count)} × {_fmt(part)}")
            elif kind == "walls":
                length = _num(row.get("length"), label=f"Surface {index} length")
                width = _num(row.get("width"), label=f"Surface {index} width")
                height = _num(row.get("height"), label=f"Surface {index} height")
                part = Decimal("2") * (length + width) * height
                bits.append(f"walls 2 × ({_fmt(length)} + {_fmt(width)}) × {_fmt(height)}")
            else:
                part = _num(row.get("area") if row.get("area") not in (None, "") else row.get("quantity"), label=f"Surface {index} area")
                bits.append(f"surface {_fmt(part)}")
            gross += part * (count or Decimal("1"))
        formula = " + ".join(bits)
    elif surface == "walls":
        length = _num(inputs.get("length"), label="Length")
        width = _num(inputs.get("width"), label="Width")
        height = _num(inputs.get("height"), label="Height")
        gross = Decimal("2") * (length + width) * height
        formula = f"2 × ({_fmt(length)} + {_fmt(width)}) × {_fmt(height)} = {_fmt(gross)}"
    elif surface in ("floor", "ceiling"):
        length = _num(inputs.get("length"), label="Length")
        width = _num(inputs.get("width"), label="Width")
        gross = length * width
        formula = f"{_fmt(length)} × {_fmt(width)} = {_fmt(gross)}"
    else:
        gross = _num(inputs.get("area") if inputs.get("area") not in (None, "") else inputs.get("quantity"), label="Area")
        formula = f"{_fmt(gross)}"
    deducted, opening_formula = _openings(inputs.get("openings"))
    net = gross - deducted
    if net < 0:
        raise AppError(422, "negative_quantity", "Openings are larger than the measured area. Net quantity can't be negative.")
    if deducted:
        formula = f"{formula}; deductions {opening_formula}; net {_fmt(net)}"
    unit = str(inputs.get("unit") or "sqft")
    return {
        "measurementType": "area",
        "quantity": qty(net),
        "unit": unit,
        "grossQuantity": qty(gross),
        "deductions": qty(deducted),
        "formula": formula,
        "surface": surface,
    }


def _quantity(inputs: dict[str, Any]) -> dict[str, Any]:
    count = _num(inputs.get("quantity") if inputs.get("quantity") not in (None, "") else inputs.get("count"), label="Quantity")
    if count <= 0:
        raise AppError(422, "invalid_quantity", "Quantity must be more than 0.")
    unit = str(inputs.get("unit") or "piece")
    name = str(inputs.get("item") or inputs.get("name") or inputs.get("specification") or "Items")
    return {
        "measurementType": "quantity",
        "quantity": qty(count),
        "unit": unit,
        "formula": f"{_fmt(count)} {unit}",
        "item": name,
    }


def _length(inputs: dict[str, Any]) -> dict[str, Any]:
    unit = str(inputs.get("unit") or "rft").strip().lower()
    if unit not in _LENGTH_UNITS:
        raise AppError(422, "invalid_unit", "Length unit must be ft, rft, m or rmt. Don't mix units in one measurement.")
    segments = inputs.get("segments")
    total = Decimal("0")
    parts: list[str] = []
    if isinstance(segments, list) and segments:
        for index, segment in enumerate(segments, start=1):
            if not isinstance(segment, dict):
                raise AppError(422, "invalid_segment", f"Segment {index} is incomplete.")
            seg_unit = str(segment.get("unit") or unit).strip().lower()
            if seg_unit != unit:
                raise AppError(422, "mixed_units", "All length segments must use the same unit. Convert them before saving.")
            length = _num(segment.get("length"), label=f"Segment {index} length")
            count = _num(segment.get("count") or 1, label=f"Segment {index} count") or Decimal("1")
            total += length * count
            parts.append(f"{_fmt(count)} × {_fmt(length)}")
    else:
        length = _num(inputs.get("length"), label="Length")
        count = _num(inputs.get("count") or inputs.get("segments") or 1, label="Segment count") or Decimal("1")
        total = length * count
        parts.append(f"{_fmt(count)} × {_fmt(length)}")
    if total <= 0:
        raise AppError(422, "invalid_quantity", "Length must be more than 0.")
    formula = " + ".join(parts) + f" = {_fmt(total)} {unit}"
    return {"measurementType": "length", "quantity": qty(total), "unit": unit, "formula": formula}


def _time(inputs: dict[str, Any]) -> dict[str, Any]:
    raw_unit = str(inputs.get("unit") or "days").strip().lower()
    if raw_unit not in _TIME_UNITS:
        raise AppError(422, "invalid_unit", "Time is measured in hours or days.")
    unit = _TIME_UNITS[raw_unit]
    duration = _num(inputs.get("duration") if inputs.get("duration") not in (None, "") else inputs.get("quantity"), label="Duration")
    if duration <= 0:
        raise AppError(422, "invalid_quantity", "Planned duration must be more than 0.")
    crew = _num(inputs.get("crewSize") or 0, label="Crew size")
    result: dict[str, Any] = {
        "measurementType": "time",
        "quantity": qty(duration),
        "unit": unit,
        "formula": f"{_fmt(duration)} {unit}",
        "plannedOnly": True,
    }
    if crew > 0:
        worker_unit = "worker-days" if unit == "days" else "worker-hours"
        planned = duration * crew
        result["workerQuantity"] = qty(planned)
        result["workerUnit"] = worker_unit
        result["formula"] = f"{_fmt(crew)} × {_fmt(duration)} {unit} = {_fmt(planned)} {worker_unit}"
    return result


def _fixed(inputs: dict[str, Any]) -> dict[str, Any]:
    title = str(inputs.get("title") or inputs.get("scope") or "Defined job").strip()
    if not title:
        raise AppError(422, "scope_required", "Describe the fixed scope.")
    return {
        "measurementType": "fixed",
        "quantity": "1",
        "unit": "job",
        "formula": "1 job",
        "title": title,
        "description": str(inputs.get("description") or ""),
        "inclusions": str(inputs.get("inclusions") or ""),
        "exclusions": str(inputs.get("exclusions") or ""),
        "location": str(inputs.get("location") or ""),
    }


_FNS = {"area": _area, "quantity": _quantity, "length": _length, "time": _time, "fixed": _fixed}


def compute_scope(measurement_type: str, inputs: dict[str, Any] | None) -> dict[str, Any]:
    kind = str(measurement_type or "").strip().lower()
    fn = _FNS.get(kind)
    if not fn:
        raise AppError(422, "unknown_measurement_type", "Measurement type must be area, quantity, length, time or fixed.")
    result = fn(inputs or {})
    cleaned: dict[str, Any] = {}
    for key, value in result.items():
        if isinstance(value, Decimal):
            text = format(value.normalize(), "f")
            if "." in text:
                text = text.rstrip("0").rstrip(".")
            cleaned[key] = text or "0"
        else:
            cleaned[key] = value
    return cleaned
