from fastapi import APIRouter, Depends

from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.store import get_store
from app.reports.service import gst_summary, owner_dashboard, project_profitability

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
def dashboard(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.REPORT_VIEW)
    return owner_dashboard(get_store(), ctx.require_org())


@router.get("/gst")
def gst(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return gst_summary(get_store(), ctx.require_org())


@router.get("/project-profitability/{project_id}")
def profitability(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROFIT_VIEW)
    return project_profitability(get_store(), ctx.require_org(), project_id)
