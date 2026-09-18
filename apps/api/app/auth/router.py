from fastapi import APIRouter, Depends, Request

from app.core.collections import MEMBERSHIPS, ORGANIZATIONS
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import entitlements_for
from app.core.permissions import ROLE_PERMISSIONS
from app.core.store import get_store
from app.platform.models import TrialSignupIn
from app.platform.quota import entitlements_payload
from app.platform.ratelimit import limit_ip
from app.platform.service import trial_signup

router = APIRouter(tags=["auth"])


@router.post("/auth/trial-signup")
def public_trial_signup(payload: TrialSignupIn, request: Request):
    ip = request.client.host if request.client else "unknown"
    limit_ip(f"trial:{ip}", max_hits=5, window_seconds=3600)
    return trial_signup(
        company_name=payload.company_name,
        owner_name=payload.owner_name,
        email=payload.email,
        password=payload.password,
    )


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
        "isPlatformAdmin": ctx.is_platform_admin,
        "entitlements": entitlements_payload(ctx.org_id),
    }


@router.get("/roles")
def roles(ctx: RequestContext = Depends(get_ctx)):
    return {"roles": ROLE_PERMISSIONS}
