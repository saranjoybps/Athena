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
            return {"uid": uid, "email": f"{uid}@dev.athena", "phone": None}
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
    store = get_store()
    memberships = get_memberships_for_user(store, user_id)
    org_id = None
    roles: list[str] = []
    membership_id = None
    if memberships:
        chosen = None
        if x_organization_id:
            chosen = next((m for m in memberships if m.get("orgId") == x_organization_id), None)
            # Stale X-Organization-Id after memory reseed / org recreate — fall back
            # instead of leaving the user with empty permissions.
            if chosen is None:
                chosen = memberships[0]
        else:
            chosen = memberships[0]
        org_id = chosen["orgId"]
        roles = list(chosen.get("roles") or [])
        membership_id = chosen["id"]
    elif x_organization_id:
        raise AppError(
            403,
            "forbidden",
            "No organization membership for this account. Complete onboarding first.",
        )
    perms: set[str] = set()
    for role in roles:
        perms.update(ROLE_PERMISSIONS.get(role, []))
    ctx = RequestContext(
        request_id=getattr(request.state, "request_id", ""),
        user_id=user_id,
        email=claims.get("email"),
        phone=claims.get("phone"),
        org_id=org_id,
        branch_id=x_branch_id,
        roles=roles,
        permissions=perms,
        membership_id=membership_id,
        is_customer="customer" in roles,
    )
    request.state.ctx = ctx
    return ctx


def get_ctx(ctx: RequestContext = Depends(resolve_context)) -> RequestContext:
    return ctx
