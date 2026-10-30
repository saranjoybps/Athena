"""Attendance rules shared by marking, schedule edits, labour billing and reports."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.collections import ATTENDANCE, CREWS, LABOUR, PROJECT_SCHEDULES, PROJECTS
from app.core.errors import AppError
from app.core.repo import org_owned

IST = timezone(timedelta(hours=5, minutes=30))

STATUSES = {"present", "half_day", "leave", "absent", "overtime"}
PAID_STATUSES = {"present", "half_day", "overtime"}
STATUS_LABELS = {
    "present": "present",
    "half_day": "half day",
    "leave": "on leave",
    "absent": "absent",
    "overtime": "overtime",
}


def today_local() -> str:
    return datetime.now(IST).date().isoformat()


def parse_day(value: Any) -> str | None:
    raw = str(value or "")[:10]
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


def pretty_day(value: str) -> str:
    try:
        d = date.fromisoformat(value)
    except ValueError:
        return value
    return f"{d.day} {d.strftime('%b %Y')}"


def live(rows: list[dict]) -> list[dict]:
    return [r for r in rows if not r.get("deletedAt")]


def crew_spans(store, org_id: str, project_id: str, crew_id: str, exclude_id: str | None = None) -> list[tuple[str, str]]:
    """Scheduled (start, end) day ranges for one crew on one project."""
    rows = live(
        store.query(
            PROJECT_SCHEDULES,
            filters=[("orgId", "==", org_id), ("projectId", "==", project_id)],
            limit=500,
        )
    )
    spans: list[tuple[str, str]] = []
    for row in rows:
        if exclude_id and str(row.get("id")) == exclude_id:
            continue
        if str(row.get("crewId") or "") != crew_id:
            continue
        start = parse_day(row.get("startDate"))
        end = parse_day(row.get("endDate")) or start
        if start and end:
            spans.append((start, end))
    return sorted(spans)


def in_spans(day: str, spans: list[tuple[str, str]]) -> bool:
    return any(start <= day <= end for start, end in spans)


def expand_days(start: str, end: str, limit: int = 400) -> list[str]:
    first = date.fromisoformat(start)
    last = date.fromisoformat(end)
    days: list[str] = []
    cursor = first
    while cursor <= last and len(days) < limit:
        days.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return days


def schedule_working_days(row: dict) -> set[str]:
    """Payable dates. An explicit list can skip days inside the calendar span (Sunday off)."""
    explicit = row.get("workingDates")
    if isinstance(explicit, list) and any(parse_day(d) for d in explicit):
        return {d for d in (parse_day(item) for item in explicit) if d}
    start = parse_day(row.get("startDate"))
    end = parse_day(row.get("endDate")) or start
    if not start or not end or end < start:
        return set()
    return set(expand_days(start, end))


def crew_schedule_rows(store, org_id: str, project_id: str, crew_id: str, exclude_id: str | None = None) -> list[dict]:
    rows = live(
        store.query(
            PROJECT_SCHEDULES,
            filters=[("orgId", "==", org_id), ("projectId", "==", project_id)],
            limit=500,
        )
    )
    out = []
    for row in rows:
        if exclude_id and str(row.get("id")) == exclude_id:
            continue
        if str(row.get("crewId") or "") != crew_id:
            continue
        out.append(row)
    return out


def covered_days(rows: list[dict]) -> set[str]:
    days: set[str] = set()
    for row in rows:
        days |= schedule_working_days(row)
    return days


def crew_member_ids(crew: dict) -> set[str]:
    return {
        str(m.get("labourId") or m.get("workerId") or "")
        for m in crew.get("members") or []
        if isinstance(m, dict) and (m.get("labourId") or m.get("workerId"))
    }


def worker_marks_on_day(store, org_id: str, worker_id: str, day: str) -> list[dict]:
    # Equality-only filters: no composite index needed.
    return live(
        store.query(
            ATTENDANCE,
            filters=[("orgId", "==", org_id), ("workerId", "==", worker_id), ("date", "==", day)],
            limit=50,
        )
    )


def validate_status(status: str) -> str:
    key = str(status or "").strip().lower()
    if key not in STATUSES:
        raise AppError(400, "invalid_status", "Pick present, half day or leave.")
    return key


def validate_window(store, org_id: str, project_id: str, crew: dict, day: str) -> None:
    if day > today_local():
        raise AppError(400, "attendance_future", "Attendance can't be marked for a future date.")
    crew_name = str(crew.get("name") or "This crew")
    rows = crew_schedule_rows(store, org_id, project_id, str(crew["id"]))
    days = covered_days(rows)
    if not days:
        raise AppError(
            400,
            "crew_not_scheduled",
            f"{crew_name} isn't scheduled on this project. Add it to the project schedule first.",
        )
    if day not in days:
        sample = ", ".join(pretty_day(d) for d in sorted(days)[:6])
        raise AppError(
            400,
            "outside_schedule",
            f"{crew_name} is scheduled on this project for {sample}. "
            "Attendance can only be marked for those working days, not for days left off the schedule.",
        )


def check_double_booking(store, org_id: str, worker: dict, project_id: str, day: str, status: str, marks: list[dict]) -> None:
    if status not in PAID_STATUSES:
        return
    for row in marks:
        if str(row.get("projectId") or "") == project_id:
            continue
        other = str(row.get("status") or "")
        if other not in PAID_STATUSES or (other == "half_day" and status == "half_day"):
            continue
        project = store.get(PROJECTS, str(row.get("projectId") or "")) or {}
        label = " ".join(str(v) for v in (project.get("number"), project.get("name")) if v) or "another project"
        raise AppError(
            409,
            "worker_double_booked",
            f"{worker.get('name') or 'This worker'} was already marked {STATUS_LABELS.get(other, other)} on another project "
            f"({label}) for {pretty_day(day)}. A worker is paid for one project per day: clear that mark first, "
            "or mark half day on both projects.",
            {"projectId": project.get("id"), "workerId": worker.get("id"), "date": day},
        )


def load_mark_context(store, org_id: str, project_id: str, crew_id: str | None, worker_id: str | None):
    org_owned(store, PROJECTS, project_id, org_id)
    if not worker_id:
        raise AppError(400, "worker_required", "Pick the worker to mark.")
    if not crew_id:
        raise AppError(400, "crew_required", "Pick the crew this worker is working with.")
    worker = org_owned(store, LABOUR, worker_id, org_id)
    crew = org_owned(store, CREWS, crew_id, org_id)
    if worker_id not in crew_member_ids(crew):
        raise AppError(
            400,
            "worker_not_in_crew",
            f"{worker.get('name') or 'This worker'} isn't a member of {crew.get('name') or 'this crew'}.",
        )
    return worker, crew


def uncovered_attendance(store, org_id: str, project_id: str, crew_id: str, spans: list[tuple[str, str]], working: set[str] | None = None) -> list[dict]:
    """Attendance for a crew on a project that would fall outside the remaining working days."""
    rows = live(
        store.query(
            ATTENDANCE,
            filters=[("orgId", "==", org_id), ("projectId", "==", project_id), ("crewId", "==", crew_id)],
            limit=1000,
        )
    )
    out = []
    for row in rows:
        day = parse_day(row.get("date"))
        if not day:
            continue
        covered = day in working if working is not None else in_spans(day, spans)
        if not covered:
            out.append(row)
    return sorted(out, key=lambda r: str(r.get("date") or ""))


def latest_marks(rows: list[dict]) -> list[dict]:
    """One mark per project, worker and day (older duplicate taps are ignored)."""
    keep: dict[tuple[str, str, str], dict] = {}
    loose: list[dict] = []
    for row in rows:
        wid = str(row.get("workerId") or "")
        day = parse_day(row.get("date"))
        if not wid or not day:
            loose.append(row)
            continue
        key = (str(row.get("projectId") or ""), wid, day)
        prev = keep.get(key)
        if prev is None or str(row.get("updatedAt") or row.get("createdAt") or "") >= str(
            prev.get("updatedAt") or prev.get("createdAt") or ""
        ):
            keep[key] = row
    return list(keep.values()) + loose
