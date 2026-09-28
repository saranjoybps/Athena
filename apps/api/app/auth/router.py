from fastapi import APIRouter, Depends, Request

from app.core.collections import MEMBERSHIPS, ORGANIZATIONS, USERS
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import entitlements_for
from app.core.membership_cache import invalidate_membership_cache
from app.core.permissions import ROLE_PERMISSIONS
from app.core.repo import now_iso
from app.core.store import get_store
from app.platform.identity import delete_auth_user
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
        if m.get("deletedAt") or m.get("status") == "disabled":
            continue
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


@router.delete("/me/account")
def delete_my_account(ctx: RequestContext = Depends(get_ctx)):
    """End-user account deletion for Google Play / privacy requirements.

    Disables all memberships, anonymizes the user profile, and deletes the auth user.
    Workspace business records may be retained for legitimate business/legal needs.
    """
    store = get_store()
    uid = ctx.user_id
    stamp = now_iso()

    memberships = store.query(MEMBERSHIPS, filters=[("userId", "==", uid)], limit=50)
    for membership in memberships:
        mid = membership.get("id")
        if not mid:
            continue
        membership["deletedAt"] = stamp
        membership["status"] = "disabled"
        membership["updatedAt"] = stamp
        store.set(MEMBERSHIPS, mid, membership)

    user = store.get(USERS, uid) or {"id": uid}
    user.update(
        {
            "email": None,
            "name": "Deleted user",
            "displayName": "Deleted user",
            "phone": None,
            "deletedAt": stamp,
            "status": "deleted",
            "updatedAt": stamp,
        }
    )
    store.set(USERS, uid, user)

    invalidate_membership_cache(uid)
    delete_auth_user(uid)

    return {
        "ok": True,
        "deletedAt": stamp,
        "message": "Account deleted. Authentication access has been removed.",
    }


@router.get("/roles")
def roles(ctx: RequestContext = Depends(get_ctx)):
    return {"roles": ROLE_PERMISSIONS}
