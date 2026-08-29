from fastapi import APIRouter, Depends

from app.core.collections import MEMBERSHIPS, ORGANIZATIONS
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import entitlements_for
from app.core.permissions import ROLE_PERMISSIONS
from app.core.store import get_store

router = APIRouter(tags=["auth"])


@router.get("/me")
def me(ctx: RequestContext = Depends(get_ctx)):
    store = get_store()
    memberships = store.query(MEMBERSHIPS, filters=[("userId", "==", ctx.user_id)], limit=50)
    orgs = []
    for m in memberships:
        org = store.get(ORGANIZATIONS, m["orgId"])
        if org:
            orgs.append(
                {
                    "organization": org,
                    "membership": m,
                    "entitlements": entitlements_for(org),
                    "roles": m.get("roles"),
                }
            )
    return {
        "userId": ctx.user_id,
        "email": ctx.email,
        "orgId": ctx.org_id,
        "roles": ctx.roles,
        "permissions": sorted(ctx.permissions),
        "memberships": orgs,
    }


@router.get("/roles")
def roles(ctx: RequestContext = Depends(get_ctx)):
    return {"roles": ROLE_PERMISSIONS}
