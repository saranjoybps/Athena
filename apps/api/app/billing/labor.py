from __future__ import annotations

from datetime import date, datetime

from app.attendance.service import latest_marks
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


def _attendance_factor(status: str | None) -> float | None:
    """Present = 1, half_day = 0.5, leave/absent = 0 (skip)."""
    key = str(status or "").strip().lower()
    if key == "present" or key == "overtime":
        return 1.0
    if key == "half_day":
        return 0.5
    if key in {"leave", "absent"}:
        return 0.0
    return None


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


def _schedule_day_spans(store: DocumentStore, org_id: str, project_id: str) -> list[tuple[date, date, str | None]]:
    schedules = list_org(
        store, PROJECT_SCHEDULES, org_id, extra_filters=[("projectId", "==", project_id)], limit=200
    )
    spans: list[tuple[date, date, str | None]] = []
    for row in schedules:
        start = _parse_date(row.get("startDate"))
        end = _parse_date(row.get("endDate")) or start
        if not start or not end:
            continue
        spans.append((start, end, str(row.get("crewId") or "") or None))
    return spans


def labor_lines_from_attendance_and_schedule(store: DocumentStore, org_id: str, project_id: str) -> list[dict]:
    """
    Labour = worker.dailyRate × attendance factor, limited to scheduled date ranges when schedules exist.
    If schedules exist but no attendance, return [] so invoice UI can take manual labour.
    If no schedules, fall back to attendance-only totals (still wage × marked days).
    """
    spans = _schedule_day_spans(store, org_id, project_id)
    attendance = latest_marks(
        [
            r
            for r in store.query(
                ATTENDANCE, filters=[("orgId", "==", org_id), ("projectId", "==", project_id)], limit=5000
            )
            if not r.get("deletedAt")
        ]
    )
    if not attendance:
        return []

    crew_member_ids: set[str] | None = None
    if spans:
        crew_member_ids = set()
        for _, _, crew_id in spans:
            if not crew_id:
                continue
            crew = store.get(CREWS, crew_id) or {}
            for m in crew.get("members") or []:
                if isinstance(m, dict) and m.get("labourId"):
                    crew_member_ids.add(str(m["labourId"]))

    by_worker: dict[str, float] = {}
    for row in attendance:
        worker_id = row.get("workerId")
        if not worker_id:
            continue
        wid = str(worker_id)
        if crew_member_ids is not None and crew_member_ids and wid not in crew_member_ids:
            # Still allow attendance for workers marked on the project even if not in crew list
            pass
        factor = _attendance_factor(str(row.get("status") or ""))
        if factor is None or factor <= 0:
            continue
        att_date = _parse_date(row.get("date") or row.get("createdAt"))
        if spans:
            if not att_date:
                continue
            in_span = any(start <= att_date <= end for start, end, _ in spans)
            if not in_span:
                continue
        by_worker[wid] = by_worker.get(wid, 0.0) + factor

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
    - Contract sqft measurements take priority.
    - Else: dailyRate × attendance (Present/Half/Leave) within schedule window when scheduled.
    - If nothing computed, return [] so the client can enter labour manually.
    """
    project = store.get(PROJECTS, project_id) or {}
    contract_lines = contract_sqft_lines_for_project(store, org_id, project)
    if contract_lines:
        return contract_lines

    return labor_lines_from_attendance_and_schedule(store, org_id, project_id)
