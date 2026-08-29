from fastapi import APIRouter, Depends

from app.core.collections import ATTENDANCE, DAILY_REPORTS, PROJECTS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, stamp_new
from app.core.store import get_store
from app.projects.schemas import AttendanceIn, DailyReportIn

attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])
reports_router = APIRouter(prefix="/daily-reports", tags=["daily_reports"])


@attendance_router.post("")
def mark(payload: AttendanceIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ATTENDANCE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, PROJECTS, payload.projectId, org_id)
    data = payload.model_dump()
    data["userId"] = ctx.user_id
    return store.create(ATTENDANCE, stamp_new(org_id, data))


@attendance_router.get("")
def list_att(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ATTENDANCE_READ)
    return {"items": list_org(get_store(), ATTENDANCE, ctx.require_org())}


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
