from fastapi import APIRouter, Depends
from pydantic import BaseModel
import secrets
import string

from app.core.collections import MEMBERSHIPS, USERS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.mail import send_email
from app.platform.identity import create_or_get_auth_user, set_org_claims
from app.platform.quota import assert_quota
from app.core.permissions import MODULE_ACCESS, ROLE_PERMISSIONS, Permission
from app.core.repo import list_org, now_iso
from app.core.store import get_store
from app.core.membership_cache import invalidate_membership_cache

router = APIRouter(prefix="/users", tags=["users"])


class InviteIn(BaseModel):
    email: str
    role: str | None = None
    roles: list[str] | None = None
    name: str | None = None
    temporaryPassword: str | None = None


class UserUpdateIn(BaseModel):
    name: str | None = None
    role: str | None = None
    roles: list[str] | None = None
    status: str | None = None


def _normalize_roles(roles: list[str] | None, role: str | None = None) -> list[str]:
    values = [str(r).strip() for r in (roles or []) if str(r).strip()]
    if role and str(role).strip():
        values.append(str(role).strip())
    # Prefer module keys; keep unique order
    seen: list[str] = []
    for r in values:
        key = "project_manager" if r == "manager" else r
        if key not in ROLE_PERMISSIONS:
            continue
        if key not in seen:
            seen.append(key)
    return seen or ["field"]


def _access_labels(roles: list[str]) -> list[str]:
    labels = {
        "admin": "Admin",
        "home": "Home",
        "accounts": "Accounts",
        "inventory": "Inventory",
        "field": "Field",
        "owner": "Owner",
        "project_manager": "Home",
        "manager": "Home",
        "accountant": "Accounts",
        "supervisor": "Field",
        "worker": "Field",
        "estimator": "Home",
    }
    out: list[str] = []
    for r in roles:
        label = labels.get(r, r.replace("_", " ").title())
        if label not in out:
            out.append(label)
    return out


def _temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("")
def list_users(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.USER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    items = []
    for m in list_org(store, MEMBERSHIPS, org_id):
        user = store.get(USERS, m.get("userId") or "") if m.get("userId") else None
        roles = list(m.get("roles") or [])
        items.append(
            {
                **m,
                "name": m.get("name") or (user or {}).get("name"),
                "email": m.get("email") or (user or {}).get("email"),
                "displayName": (user or {}).get("name") or m.get("name") or m.get("userId") or m.get("email"),
                "access": _access_labels(roles),
                "modules": [r for r in roles if r in MODULE_ACCESS],
            }
        )
    return {"items": items}


@router.post("/invite")
def invite(payload: InviteIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.USER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    email = payload.email.strip().lower()
    if not email:
        raise AppError(400, "email_required", "Email is required.")
    assert_quota(org_id, "users")
    temp = (payload.temporaryPassword or "").strip() or _temp_password()
    uid = create_or_get_auth_user(email, temp, payload.name or email.split("@")[0])
    set_org_claims(uid, org_id, (_normalize_roles(payload.roles, payload.role) or ["field"])[0])

    user_doc = store.get(USERS, uid) or {}
    store.set(
        USERS,
        uid,
        {
            **user_doc,
            "id": uid,
            "email": email,
            "name": payload.name or user_doc.get("name") or email.split("@")[0],
            "updatedAt": now_iso(),
            "createdAt": user_doc.get("createdAt") or now_iso(),
        },
    )

    roles = _normalize_roles(payload.roles, payload.role)
    membership = store.create(
        MEMBERSHIPS,
        {
            "orgId": org_id,
            "userId": uid,
            "email": email,
            "roles": roles,
            "status": "active",
            "name": payload.name,
            "createdAt": now_iso(),
        },
        doc_id=f"{uid}_{org_id}",
    )
    invalidate_membership_cache(uid)

    mail = send_email(
        to=email,
        subject="You're invited to Athena",
        body=(
            f"Hi {payload.name or ''},\n\n"
            f"You have been invited to Athena.\n"
            f"Email: {email}\n"
            f"Temporary password: {temp}\n\n"
            f"Sign in and change your password after first login.\n"
        ),
    )
    return {**membership, "temporaryPassword": temp, "emailResult": mail}


@router.patch("/{membership_id}")
def update_user(membership_id: str, payload: UserUpdateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.USER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    membership = store.get(MEMBERSHIPS, membership_id)
    if not membership or membership.get("orgId") != org_id:
        raise AppError(404, "not_found", "User membership not found.")
    fields = payload.model_dump(exclude_unset=True)
    if "roles" in fields or "role" in fields:
        membership["roles"] = _normalize_roles(fields.pop("roles", None), fields.pop("role", None))
    membership.update({k: v for k, v in fields.items() if v is not None})
    membership["updatedAt"] = now_iso()
    saved = store.set(MEMBERSHIPS, membership_id, membership)
    if payload.name and membership.get("userId"):
        user = store.get(USERS, membership["userId"]) or {"id": membership["userId"]}
        user["name"] = payload.name
        user["updatedAt"] = now_iso()
        store.set(USERS, membership["userId"], user)
    return saved
