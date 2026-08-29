from fastapi import APIRouter, Depends

from app.core.collections import INVOICES, PROJECTS, QUOTES, SNAGS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned
from app.core.store import get_store
from app.reports.service import redact_for_customer

router = APIRouter(prefix="/portal", tags=["portal"])


@router.get("/projects")
def portal_projects(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    items = [redact_for_customer(p) for p in list_org(get_store(), PROJECTS, ctx.require_org())]
    return {"items": items}


@router.get("/quotes")
def portal_quotes(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.QUOTE_READ)
    items = [redact_for_customer(q) for q in list_org(get_store(), QUOTES, ctx.require_org())]
    return {"items": items}


@router.get("/invoices")
def portal_invoices(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    items = list_org(get_store(), INVOICES, ctx.require_org())
    return {"items": items}


@router.get("/snags")
def portal_snags(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SNAG_MANAGE)
    return {"items": list_org(get_store(), SNAGS, ctx.require_org())}


@router.get("/projects/{project_id}")
def portal_project(project_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.PROJECT_READ)
    return redact_for_customer(org_owned(get_store(), PROJECTS, project_id, ctx.require_org()))
