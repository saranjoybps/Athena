from __future__ import annotations

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import AppError
from app.platform.models import TenantStatus, is_trial_expired
from app.platform.store import get_platform_tenant


def _path(request: Request) -> str:
    return request.url.path.rstrip("/") or "/"


def is_unprotected_path(path: str, method: str) -> bool:
    if method.upper() == "OPTIONS":
        return True
    prefix = get_settings().api_prefix.rstrip("/")
    if path in ("/health", f"{prefix}/auth/trial-signup"):
        return True
    return False


def is_platform_path(path: str) -> bool:
    prefix = get_settings().api_prefix.rstrip("/")
    return path.startswith(f"{prefix}/platform")


def is_me_get(path: str, method: str) -> bool:
    prefix = get_settings().api_prefix.rstrip("/")
    return method.upper() == "GET" and path in (f"{prefix}/me", "/me")


def check_tenant_access(org_id: str | None, request: Request) -> None:
    """Hard-lock expired trials and suspended tenants. Missing platform row is skipped."""
    path = _path(request)
    method = request.method
    if is_unprotected_path(path, method) or is_platform_path(path):
        return
    if not org_id:
        return
    tenant = get_platform_tenant(org_id)
    if not tenant:
        return
    status = tenant.get("status")
    if status == TenantStatus.SUSPENDED:
        raise AppError(403, "tenant_suspended", "This workspace is suspended.")
    if status == TenantStatus.DEACTIVATED:
        raise AppError(403, "tenant_deactivated", "This workspace is deactivated.")
    if is_trial_expired(tenant):
        if is_me_get(path, method):
            return
        raise AppError(403, "trial_expired", "Your trial has ended. Sign in after an upgrade.")
