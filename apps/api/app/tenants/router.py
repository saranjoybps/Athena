from fastapi import APIRouter, Depends

from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.platform.models import UpgradeRequestIn
from app.platform import service
from app.platform.store import get_pending_upgrade, get_platform_tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/me/upgrade-request")
def get_upgrade(ctx: RequestContext = Depends(get_ctx)):
    org_id = ctx.require_org()
    if not get_platform_tenant(org_id):
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    return {"item": get_pending_upgrade(org_id)}


@router.post("/me/upgrade-request")
def post_upgrade(payload: UpgradeRequestIn, ctx: RequestContext = Depends(get_ctx)):
    org_id = ctx.require_org()
    return service.request_upgrade(
        org_id,
        message=payload.message,
        requested_by=ctx.user_id,
        email=ctx.email,
    )
