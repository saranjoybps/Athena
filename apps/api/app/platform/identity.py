from __future__ import annotations

import hashlib
import uuid
from typing import Any

from app.core.collections import DEV_AUTH_CLAIMS, DEV_AUTH_EMAILS, USERS
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.repo import now_iso
from app.core.store import get_store


def is_platform_admin(uid: str) -> bool:
    return uid in get_settings().platform_admin_uid_set


def set_org_claims(uid: str, org_id: str, role: str = "owner") -> None:
    settings = get_settings()
    if settings.athena_auth == "dev":
        get_store().set(DEV_AUTH_CLAIMS, uid, {"org_id": org_id, "role": role})
        return
    from firebase_admin import auth

    from app.core.firebase_auth import _ensure_firebase_app

    _ensure_firebase_app()
    auth.set_custom_user_claims(uid, {"org_id": org_id, "role": role})


def lookup_uid_by_email(email: str) -> str | None:
    settings = get_settings()
    email = email.strip().lower()
    if settings.athena_auth == "dev":
        row = get_store().get(DEV_AUTH_EMAILS, email)
        if row and row.get("uid"):
            return str(row["uid"])
        users = get_store().query(USERS, filters=[("email", "==", email)], limit=1)
        return users[0]["id"] if users else None
    from firebase_admin import auth

    from app.core.firebase_auth import _ensure_firebase_app

    _ensure_firebase_app()
    try:
        return auth.get_user_by_email(email).uid
    except auth.UserNotFoundError:
        return None


def create_auth_user(email: str, password: str, display_name: str) -> str:
    """Create an auth user. Raises 409 if the email already exists."""
    settings = get_settings()
    email = email.strip().lower()
    if settings.athena_auth == "dev":
        existing = lookup_uid_by_email(email)
        if existing:
            raise AppError(409, "email_exists", "An account with this email already exists.")
        uid = hashlib.sha256(f"{email}:{uuid.uuid4().hex}".encode()).hexdigest()[:24]
        store = get_store()
        store.set(DEV_AUTH_EMAILS, email, {"uid": uid, "email": email})
        store.set(
            USERS,
            uid,
            {
                "id": uid,
                "email": email,
                "name": display_name or email.split("@")[0],
                "createdAt": now_iso(),
                "updatedAt": now_iso(),
            },
        )
        return uid

    from firebase_admin import auth

    from app.core.firebase_auth import _ensure_firebase_app

    _ensure_firebase_app()
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name or email.split("@")[0],
        )
        return user.uid
    except Exception as exc:
        err = str(exc)
        if "EMAIL_EXISTS" in err or "email-already-exists" in err.lower():
            raise AppError(409, "email_exists", "An account with this email already exists.") from exc
        raise AppError(400, "auth_user_failed", f"Failed to create user: {err}") from exc


def create_or_get_auth_user(email: str, password: str, display_name: str) -> str:
    """Invite path: reuse an existing auth user or create one."""
    settings = get_settings()
    email = email.strip().lower()
    if settings.athena_auth == "dev":
        existing = lookup_uid_by_email(email)
        if existing:
            return existing
        return create_auth_user(email, password, display_name)

    from firebase_admin import auth

    from app.core.firebase_auth import _ensure_firebase_app

    _ensure_firebase_app()
    try:
        existing = auth.get_user_by_email(email)
        auth.update_user(existing.uid, password=password, display_name=display_name or existing.display_name)
        return existing.uid
    except auth.UserNotFoundError:
        created = auth.create_user(email=email, password=password, display_name=display_name or email.split("@")[0])
        return created.uid


def claims_for_dev_uid(uid: str) -> dict[str, Any]:
    row = get_store().get(DEV_AUTH_CLAIMS, uid) or {}
    email_rows = get_store().query(DEV_AUTH_EMAILS, filters=[("uid", "==", uid)], limit=1)
    email = None
    if email_rows:
        email = email_rows[0].get("email")
    user = get_store().get(USERS, uid) or {}
    return {
        "org_id": row.get("org_id"),
        "role": row.get("role"),
        "email": email or user.get("email"),
    }
