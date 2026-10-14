from fastapi import APIRouter, Depends, Query

from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.store import get_store
from app.reports.accounts import accounts_overview
from app.reports.period import period_report
from app.reports.service import (
    daily_expenses_report,
    gst_summary,
    gstr1_report,
    gstr2b_report,
    measurement_report,
    owner_dashboard,
    project_profitability,
)
from app.inventory.service import stock_summary

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
def dashboard(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.REPORT_VIEW)
    return owner_dashboard(get_store(), ctx.require_org())


@router.get("/accounts")
def accounts(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return accounts_overview(get_store(), ctx.require_org())


@router.get("/period")
def period(
    mode: str = Query("month", pattern="^(month|year)$"),
    year: int = Query(...),
    month: int | None = Query(None, ge=1, le=12),
    ctx: RequestContext = Depends(get_ctx),
):
    ctx.require(Permission.ACCOUNTING_READ)
    return period_report(get_store(), ctx.require_org(), mode, year, month)


@router.get("/gst")
def gst(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return gst_summary(get_store(), ctx.require_org())


@router.get("/measurements")
def measurements_report(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.REPORT_VIEW)
    return measurement_report(get_store(), ctx.require_org())


@router.get("/inventory")
def inventory_report(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MATERIAL_READ)
    return {"items": stock_summary(get_store(), ctx.require_org())}


@router.get("/daily-expenses")
def daily_expenses(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return daily_expenses_report(get_store(), ctx.require_org())


@router.get("/gstr1")
def gstr1(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return gstr1_report(get_store(), ctx.require_org())


@router.get("/gstr2b")
def gstr2b(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ACCOUNTING_READ)
    return gstr2b_report(get_store(), ctx.require_org())


@router.get("/project-profitability/{project_id}")
def profitability(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROFIT_VIEW)
    return project_profitability(get_store(), ctx.require_org(), project_id)
