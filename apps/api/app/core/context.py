from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import Depends, Header, Request

from app.core.errors import AppError
from app.core.membership_cache import get_memberships_for_user
from app.core.permissions import ROLE_PERMISSIONS, Permission
from app.core.store import get_store


@dataclass
class RequestContext:
    request_id: str
    user_id: str
    email: str | None = None
    phone: str | None = None
    org_id: str | None = None
    branch_id: str | None = None
    roles: list[str] = field(default_factory=list)
    permissions: set[str] = field(default_factory=set)
    membership_id: str | None = None
    is_customer: bool = False
    is_platform_admin: bool = False

    def require_org(self) -> str:
        if not self.org_id:
            raise AppError(400, "org_required", "Select an organization.")
        return self.org_id

    def require(self, *perms: str) -> None:
        if Permission.WILDCARD in self.permissions:
            return
        missing = [p for p in perms if p not in self.permissions]
        if missing:
            raise AppError(403, "forbidden", "Missing permission.", {"permissions": missing})


def _token_from_header(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "unauthenticated", "Missing bearer token.")
    return authorization[7:].strip()


def verify_token(token: str) -> dict[str, Any]:
    from app.core.config import get_settings

    settings = get_settings()
    if settings.athena_auth == "dev":
        if token.startswith("dev:"):
            uid = token.split(":", 1)[1]
            from app.platform.identity import claims_for_dev_uid

            extra = claims_for_dev_uid(uid)
            email = extra.get("email") or ("demo@athena.local" if uid == "local-owner" else f"{uid}@dev.athena")
            return {
                "uid": uid,
                "email": email,
                "phone": None,
                "org_id": extra.get("org_id"),
                "role": extra.get("role"),
            }
        raise AppError(401, "unauthenticated", "Invalid development token.")
    from app.core.firebase_auth import verify_firebase_token

    return verify_firebase_token(token)


def resolve_context(
    request: Request,
    authorization: str | None = Header(default=None),
    x_organization_id: str | None = Header(default=None, alias="X-Organization-Id"),
    x_branch_id: str | None = Header(default=None, alias="X-Branch-Id"),
) -> RequestContext:
    claims = verify_token(_token_from_header(authorization))
    user_id = claims["uid"]
    from app.platform.access import check_tenant_access, is_platform_path
    from app.platform.identity import is_platform_admin as uid_is_admin

    store = get_store()
    memberships = get_memberships_for_user(store, user_id)
    org_id = None
    roles: list[str] = []
    membership_id = None
    platform_admin = uid_is_admin(user_id)
    if memberships:
        chosen = None
        if x_organization_id:
            chosen = next((m for m in memberships if m.get("orgId") == x_organization_id), None)
            if chosen is None:
                raise AppError(
                    403,
                    "forbidden",
                    "No organization membership for this account. Complete onboarding first.",
                )
        else:
            chosen = memberships[0]
        org_id = chosen["orgId"]
        roles = list(chosen.get("roles") or [])
        membership_id = chosen["id"]
    elif claims.get("org_id") and not platform_admin:
        org_id = str(claims["org_id"])
        if claims.get("role"):
            roles = [str(claims["role"])]
    elif x_organization_id and not platform_admin:
        raise AppError(
            403,
            "forbidden",
            "No organization membership for this account. Complete onboarding first.",
        )
    if platform_admin and not org_id:
        org_id = ""
    perms: set[str] = set()
    for role in roles:
        perms.update(ROLE_PERMISSIONS.get(role, []))
    if platform_admin:
        perms.add(Permission.WILDCARD)
    ctx = RequestContext(
        request_id=getattr(request.state, "request_id", ""),
        user_id=user_id,
        email=claims.get("email"),
        phone=claims.get("phone"),
        org_id=org_id or None,
        branch_id=x_branch_id,
        roles=roles,
        permissions=perms,
        membership_id=membership_id,
        is_customer="customer" in roles,
        is_platform_admin=platform_admin,
    )
    request.state.ctx = ctx
    path = request.url.path.rstrip("/") or "/"
    if not org_id and not platform_admin and not _open_without_org(path):
        raise AppError(403, "no_tenant", "No tenant assigned")
    if org_id and not is_platform_path(path):
        check_tenant_access(org_id, request)
    return ctx


def _open_without_org(path: str) -> bool:
    from app.core.config import get_settings

    prefix = get_settings().api_prefix.rstrip("/")
    rel = path[len(prefix) :] if path.startswith(prefix) else path
    return rel.rstrip("/") in ("/me", "/roles", "/onboarding")


def get_ctx(ctx: RequestContext = Depends(resolve_context)) -> RequestContext:
    return ctx


def get_platform_admin(ctx: RequestContext = Depends(resolve_context)) -> RequestContext:
    if not ctx.is_platform_admin:
        raise AppError(403, "forbidden", "Platform admin only.")
    return ctx
