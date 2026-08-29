from fastapi import APIRouter, Depends

from app.core.collections import SITES
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, stamp_new
from app.core.store import get_store
from app.sites.schemas import SiteIn

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("")
def list_sites(customer_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_READ)
    org_id = ctx.require_org()
    extra = [("customerId", "==", customer_id)] if customer_id else None
    return {"items": list_org(get_store(), SITES, org_id, extra)}


@router.post("")
def create_site(payload: SiteIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_CREATE)
    org_id = ctx.require_org()
    return get_store().create(SITES, stamp_new(org_id, payload.model_dump()))


@router.get("/{site_id}")
def get_site(site_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_READ)
    return org_owned(get_store(), SITES, site_id, ctx.require_org())
