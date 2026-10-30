"""Completed quantity against approved measurements. Attendance does not count as progress."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from app.core.collections import ATTENDANCE, CHANGE_ORDERS, DAILY_REPORTS, MEASUREMENTS, PROJECTS
from app.core.errors import AppError
from app.core.repo import list_org, org_owned
from app.engines.units import D, qty


def _dec(value: Any) -> Decimal:
    try:
        return D(value if value not in (None, "") else 0)
    except (InvalidOperation, ValueError):
        return D(0)


def _reports(store, org_id: str, project_id: str) -> list[dict]:
    return [
        r
        for r in list_org(store, DAILY_REPORTS, org_id, extra_filters=[("projectId", "==", project_id)], limit=500)
        if not r.get("deletedAt")
    ]


def _has_approved_variation(store, org_id: str, project_id: str) -> bool:
    rows = list_org(store, CHANGE_ORDERS, org_id, extra_filters=[("projectId", "==", project_id)], limit=100)
    return any(r.get("status") == "approved" and not r.get("deletedAt") for r in rows)


def logged_work(store, org_id: str, project_id: str, line_id: str, exclude_id: str | None = None) -> Decimal:
    rows = [
        r
        for r in store.query(ATTENDANCE, filters=[("orgId", "==", org_id), ("projectId", "==", project_id)], limit=2000)
        if not r.get("deletedAt") and str(r.get("id") or "") != str(exclude_id or "")
    ]
    total = D(0)
    for row in rows:
        for item in row.get("workDone") or []:
            if isinstance(item, dict) and str(item.get("lineId") or "") == line_id:
                total += _dec(item.get("quantity"))
    return total


def check_work_done(store, org_id: str, project_id: str, entries: list[Any], exclude_id: str | None = None) -> list[dict[str, str]]:
    """Keep each worker's output inside the quoted quantity for that line."""
    if not entries:
        return []
    from app.projects.budget import project_budget

    project = org_owned(store, PROJECTS, project_id, org_id)
    lines, _budget = project_budget(store, project)
    by_id = {str(line.get("id")): line for line in lines}
    variation = _has_approved_variation(store, org_id, project_id)
    cleaned: list[dict[str, str]] = []
    for entry in entries:
        raw = entry if isinstance(entry, dict) else entry.model_dump()
        quantity = _dec(raw.get("quantity"))
        if quantity < 0:
            raise AppError(422, "invalid_quantity", "Work done can't be negative.")
        if quantity == 0:
            continue
        line = by_id.get(str(raw.get("lineId") or ""))
        if not line:
            raise AppError(422, "unknown_work_line", "That item is not on this project's quotation.")
        if line.get("kind") not in ("work", "other") and not line.get("billingMethod"):
            raise AppError(422, "not_work", "Record output against the quoted work, not a material or tool charge.")
        approved = _dec(line.get("quantity"))
        fixed = str(line.get("billingMethod") or "") == "fixed" or str(line.get("unit") or "") == "job"
        if fixed and quantity > 1:
            raise AppError(422, "quantity_exceeds_measurement", "A fixed job is one job. Enter a fraction up to 1.")
        already = logged_work(store, org_id, project_id, str(line.get("id")), exclude_id)
        if not fixed and approved > 0 and already + quantity > approved and not variation:
            raise AppError(
                422,
                "quantity_exceeds_measurement",
                f"{line.get('description') or 'This item'} is quoted at {approved:f} {line.get('unit') or ''}. "
                f"{already:f} is already logged. Record an approved variation before logging more.",
            )
        cleaned.append(
            {
                "lineId": str(line.get("id")),
                "description": str(line.get("description") or ""),
                "quantity": str(qty(quantity)),
                "unit": str(raw.get("unit") or line.get("unit") or ""),
                "billingMethod": str(line.get("billingMethod") or ""),
            }
        )
    return cleaned


def assert_work_log_quantity(store, org_id: str, project_id: str, measurement_id: str | None, quantity: Any, variation: bool) -> None:
    if not measurement_id or quantity in (None, ""):
        return
    measurement = org_owned(store, MEASUREMENTS, measurement_id, org_id)
    if str(measurement.get("projectId") or "") not in ("", project_id):
        raise AppError(400, "measurement_project_mismatch", "That measurement belongs to a different project.")
    kind = str(measurement.get("measurementType") or (measurement.get("outputs") or {}).get("measurementType") or "")
    if kind == "fixed":
        return
    approved = _dec((measurement.get("outputs") or {}).get("quantity"))
    if approved <= 0:
        return
    done = sum(
        (_dec(r.get("quantityCompleted")) for r in _reports(store, org_id, project_id) if str(r.get("measurementId") or "") == measurement_id),
        D(0),
    )
    if done + _dec(quantity) <= approved:
        return
    if variation and _has_approved_variation(store, org_id, project_id):
        return
    raise AppError(
        422,
        "quantity_exceeds_measurement",
        f"Completed quantity would pass the approved {_dec((measurement.get('outputs') or {}).get('quantity')):f} "
        f"{(measurement.get('outputs') or {}).get('unit') or ''}. Record an approved variation before logging more.",
    )


def measurement_progress(store, org_id: str, project_id: str) -> dict[str, Any]:
    org_owned(store, PROJECTS, project_id, org_id)
    measurements = [
        m
        for m in list_org(store, MEASUREMENTS, org_id, extra_filters=[("projectId", "==", project_id)], limit=200)
        if not m.get("deletedAt")
    ]
    reports = _reports(store, org_id, project_id)
    items = []
    for measurement in measurements:
        outputs = measurement.get("outputs") or {}
        kind = str(measurement.get("measurementType") or outputs.get("measurementType") or measurement.get("formulaKind") or "")
        approved = _dec(outputs.get("quantity"))
        unit = str(outputs.get("unit") or "")
        done = sum((_dec(r.get("quantityCompleted")) for r in reports if str(r.get("measurementId") or "") == str(measurement.get("id"))), D(0))
        if kind == "fixed":
            percents = [_dec(r.get("progressPercent")) for r in reports if str(r.get("measurementId") or "") == str(measurement.get("id"))]
            percent = max(percents) if percents else D(0)
            items.append(
                {
                    "measurementId": measurement.get("id"),
                    "name": measurement.get("title"),
                    "measurementType": "fixed",
                    "unit": "job",
                    "approvedQuantity": "1",
                    "completedQuantity": None,
                    "remainingQuantity": None,
                    "progressPercent": str(qty(min(percent, D(100)))),
                    "formula": outputs.get("formula"),
                    "scope": outputs.get("description") or outputs.get("title"),
                }
            )
            continue
        if kind == "time":
            items.append(
                {
                    "measurementId": measurement.get("id"),
                    "name": measurement.get("title"),
                    "measurementType": "time",
                    "unit": unit,
                    "approvedQuantity": str(qty(approved)),
                    "completedQuantity": str(qty(done)),
                    "remainingQuantity": str(qty(max(approved - done, D(0)))),
                    "workerQuantity": outputs.get("workerQuantity"),
                    "workerUnit": outputs.get("workerUnit"),
                    "formula": outputs.get("formula"),
                    "note": "Completed time comes from work logs. It is not the crew schedule.",
                }
            )
            continue
        items.append(
            {
                "measurementId": measurement.get("id"),
                "name": measurement.get("title"),
                "measurementType": kind,
                "unit": unit,
                "approvedQuantity": str(qty(approved)) if approved else None,
                "completedQuantity": str(qty(done)),
                "remainingQuantity": str(qty(max(approved - done, D(0)))) if approved else None,
                "formula": outputs.get("formula"),
            }
        )
    return {"items": items}
