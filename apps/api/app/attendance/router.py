from fastapi import APIRouter, Depends

from app.attendance.service import (
    check_double_booking,
    load_mark_context,
    parse_day,
    today_local,
    validate_status,
    validate_window,
    worker_marks_on_day,
)
from app.core.collections import ATTENDANCE, DAILY_REPORTS, PROJECTS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.projects.schemas import AttendanceIn, AttendanceUpdateIn, DailyReportIn

attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])
reports_router = APIRouter(prefix="/daily-reports", tags=["daily_reports"])


@attendance_router.post("")
def mark(payload: AttendanceIn, ctx: RequestContext = Depends(get_ctx)):
    """Mark one worker for one day. Marking the same worker/project/day again updates that record."""
    ctx.require(Permission.ATTENDANCE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    status = validate_status(payload.status)
    day = parse_day(payload.date) if payload.date else today_local()
    if not day:
        raise AppError(400, "invalid_date", "Pick a valid work date.")
    worker, crew = load_mark_context(store, org_id, payload.projectId, payload.crewId, payload.workerId)
    validate_window(store, org_id, payload.projectId, crew, day)

    marks = worker_marks_on_day(store, org_id, str(worker["id"]), day)
    check_double_booking(store, org_id, worker, payload.projectId, day, status, marks)

    same = sorted(
        (r for r in marks if str(r.get("projectId") or "") == payload.projectId),
        key=lambda r: str(r.get("createdAt") or ""),
    )
    if same:
        keep, extras = same[0], same[1:]
        for dup in extras:
            soft_delete(store, ATTENDANCE, str(dup["id"]), org_id)
        return update_doc(
            store,
            ATTENDANCE,
            str(keep["id"]),
            org_id,
            {
                "status": status,
                "crewId": str(crew["id"]),
                "overtimeHours": payload.overtimeHours or "0",
                "updatedBy": ctx.user_id,
            },
        )

    data = payload.model_dump()
    data.update({"status": status, "date": day, "userId": ctx.user_id})
    return store.create(ATTENDANCE, stamp_new(org_id, data))


@attendance_router.patch("/{attendance_id}")
def update_mark(attendance_id: str, payload: AttendanceUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ATTENDANCE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    existing = org_owned(store, ATTENDANCE, attendance_id, org_id)
    status = validate_status(payload.status)
    project_id = str(existing.get("projectId") or "")
    day = parse_day(existing.get("date"))
    if not day:
        raise AppError(400, "invalid_date", "This attendance record has no work date and can't be edited.")
    worker, crew = load_mark_context(store, org_id, project_id, existing.get("crewId"), existing.get("workerId"))
    validate_window(store, org_id, project_id, crew, day)
    check_double_booking(
        store, org_id, worker, project_id, day, status, worker_marks_on_day(store, org_id, str(worker["id"]), day)
    )
    fields = {"status": status, "updatedBy": ctx.user_id}
    if payload.overtimeHours is not None:
        fields["overtimeHours"] = payload.overtimeHours
    return update_doc(store, ATTENDANCE, attendance_id, org_id, fields)


@attendance_router.delete("/{attendance_id}")
def clear_mark(attendance_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ATTENDANCE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, ATTENDANCE, attendance_id, org_id)
    update_doc(store, ATTENDANCE, attendance_id, org_id, {"deletedAt": now_iso(), "deletedBy": ctx.user_id})
    return {"ok": True}


@attendance_router.get("")
def list_att(
    project_id: str | None = None,
    crew_id: str | None = None,
    date: str | None = None,
    ctx: RequestContext = Depends(get_ctx),
):
    ctx.require(Permission.ATTENDANCE_READ)
    store = get_store()
    org_id = ctx.require_org()
    filters = [("orgId", "==", org_id)]
    if project_id:
        filters.append(("projectId", "==", project_id))
    if crew_id:
        filters.append(("crewId", "==", crew_id))
    if date:
        filters.append(("date", "==", date[:10]))
    if len(filters) == 1:
        return {"items": list_org(store, ATTENDANCE, org_id, limit=200)}
    # Equality-only filters avoid per-combination composite indexes; sorted newest first in memory.
    rows = [r for r in store.query(ATTENDANCE, filters=filters, limit=2000) if not r.get("deletedAt")]
    rows.sort(key=lambda r: (str(r.get("date") or ""), str(r.get("updatedAt") or "")), reverse=True)
    return {"items": rows}


@reports_router.post("")
def create_report(payload: DailyReportIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, PROJECTS, payload.projectId, org_id)
    data = payload.model_dump()
    data["supervisorId"] = ctx.user_id
    return store.create(DAILY_REPORTS, stamp_new(org_id, data))


@reports_router.get("")
def list_reports(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    return {"items": list_org(get_store(), DAILY_REPORTS, ctx.require_org())}
