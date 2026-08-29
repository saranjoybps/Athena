from fastapi import APIRouter, Depends

from app.core.collections import ORGANIZATIONS
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import entitlements_for
from app.core.permissions import Permission
from app.core.repo import org_owned
from app.core.store import get_store

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/current")
def current(ctx: RequestContext = Depends(get_ctx)):
    org_id = ctx.require_org()
    org = org_owned(get_store(), ORGANIZATIONS, org_id, org_id)
    ctx.require(Permission.SETTINGS_MANAGE)
    return {**org, "entitlements": entitlements_for(org)}
