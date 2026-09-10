from __future__ import annotations

from datetime import date, datetime

from app.core.collections import ATTENDANCE, CREWS, LABOUR, MEASUREMENTS, PROJECT_SCHEDULES, PROJECTS
from app.core.repo import list_org
from app.core.store import DocumentStore
from app.engines.units import D, money


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    raw = str(value)[:10]
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def _inclusive_days(start: date | None, end: date | None) -> int:
    if not start:
        return 0
    if not end:
        end = start
    if end < start:
        return 0
    return (end - start).days + 1


def _day_factor(day_type: str | None) -> float:
    return 0.5 if str(day_type or "").strip() == "half_day" else 1.0


def contract_sqft_lines_for_project(store: DocumentStore, org_id: str, project: dict) -> list[dict]:
    """Contract billing: measurement totalArea × perSqftRate when billBySqft is set."""
    site_id = project.get("siteId")
    if not site_id:
        return []
    rows = list_org(store, MEASUREMENTS, org_id, extra_filters=[("siteId", "==", site_id)], limit=20)
    lines: list[dict] = []
    for row in rows:
        if not row.get("billBySqft"):
            continue
        rate = D(row.get("perSqftRate") or 0)
        if rate <= 0:
            continue
        outputs = row.get("outputs") or {}
        qty = D(outputs.get("totalArea") or outputs.get("quantity") or outputs.get("paintableArea") or 0)
        if qty <= 0:
            # Fall back to formulaConfig.outputs from composite measurements
            cfg = (row.get("formulaConfig") or {}).get("outputs") or {}
            qty = D(cfg.get("totalArea") or cfg.get("quantity") or 0)
        if qty <= 0:
            continue
        amount = money(rate * qty)
        lines.append(
            {
                "description": f"Contract work — {qty:g} sqft @ {rate}",
                "quantity": str(qty),
                "unit": "sqft",
                "rate": str(rate),
                "amount": str(amount),
                "measurementId": row.get("id"),
                "billingMode": "contract",
            }
        )
    return lines


def labor_lines_from_schedule(store: DocumentStore, org_id: str, project_id: str) -> list[dict]:
    """Non-contract: schedule days × crew dailyCost (half_day = 0.5)."""
    schedules = list_org(
        store, PROJECT_SCHEDULES, org_id, extra_filters=[("projectId", "==", project_id)], limit=200
    )
    lines: list[dict] = []
    for row in schedules:
        crew_id = row.get("crewId")
        if not crew_id:
            continue
        crew = store.get(CREWS, str(crew_id)) or {}
        rate = D(crew.get("dailyCost") or crew.get("dailyRate") or 0)
        if rate <= 0:
            continue
        days = _inclusive_days(_parse_date(row.get("startDate")), _parse_date(row.get("endDate")))
        if days <= 0:
            continue
        factor = _day_factor(row.get("dayType"))
        qty = days * factor
        amount = money(rate * D(qty))
        if amount <= 0:
            continue
        name = crew.get("name") or "Crew"
        day_label = "half-day" if factor < 1 else "day"
        lines.append(
            {
                "description": f"Labour — {name} ({qty:g} {day_label}{'s' if qty != 1 else ''})",
                "quantity": str(qty),
                "unit": "day",
                "rate": str(rate),
                "amount": str(amount),
                "crewId": str(crew_id),
                "scheduleId": row.get("id"),
                "billingMode": "non_contract",
            }
        )
    return lines


def labor_lines_from_attendance(store: DocumentStore, org_id: str, project_id: str) -> list[dict]:
    """Fallback: attendance × worker dailyRate (half_day = 0.5)."""
    rows = list_org(store, ATTENDANCE, org_id, extra_filters=[("projectId", "==", project_id)], limit=500)
    by_worker: dict[str, float] = {}
    for row in rows:
        worker_id = row.get("workerId")
        if not worker_id:
            continue
        status = str(row.get("status") or "")
        if status == "present":
            days = 1.0
        elif status == "half_day":
            days = 0.5
        elif status == "overtime":
            days = 1.0
        else:
            continue
        by_worker[str(worker_id)] = by_worker.get(str(worker_id), 0.0) + days

    lines: list[dict] = []
    for worker_id, days in by_worker.items():
        worker = store.get(LABOUR, worker_id) or {}
        rate = D(worker.get("dailyRate") or 0)
        amount = money(rate * D(days))
        if amount <= 0:
            continue
        name = worker.get("name") or "Labour"
        lines.append(
            {
                "description": f"Labour — {name} ({days:g} day{'s' if days != 1 else ''})",
                "quantity": str(days),
                "unit": "day",
                "rate": str(rate),
                "amount": str(amount),
                "workerId": worker_id,
                "billingMode": "attendance",
            }
        )
    return lines


def labor_lines_for_project(store: DocumentStore, org_id: str, project_id: str) -> list[dict]:
    """
    Build invoice labour/contract lines for a project.
    - If site measurement has billBySqft + perSqftRate → contract sqft lines (skip schedule labour).
    - Else prefer schedule × crew daily wages; fall back to attendance × worker dailyRate.
    """
    project = store.get(PROJECTS, project_id) or {}
    contract_lines = contract_sqft_lines_for_project(store, org_id, project)
    if contract_lines:
        return contract_lines

    schedule_lines = labor_lines_from_schedule(store, org_id, project_id)
    if schedule_lines:
        return schedule_lines

    return labor_lines_from_attendance(store, org_id, project_id)
