from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.core.config import get_settings


class TenantStatus:
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    DEACTIVATED = "deactivated"


class TenantPlan:
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


TRIAL_RATE_LIMITS = {
    "requests_per_minute": 60,
    "max_users": 5,
    "max_customers": 50,
    "max_sites": 25,
}

PAID_RATE_LIMITS = {
    "requests_per_minute": 120,
    "max_users": 0,
    "max_customers": 0,
    "max_sites": 0,
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None = None) -> str:
    return (dt or utcnow()).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def trial_window(days: int | None = None) -> tuple[str, str]:
    start = utcnow()
    duration = days if days is not None else get_settings().trial_duration_days
    end = start + timedelta(days=duration)
    return iso(start), iso(end)


def trial_preset(*, name: str, slug: str, owner_email: str, owner_uid: str, notes: str = "") -> dict[str, Any]:
    starts, ends = trial_window()
    now = iso()
    return {
        "id": slug,
        "name": name,
        "slug": slug,
        "status": TenantStatus.TRIAL,
        "plan": TenantPlan.FREE,
        "owner_email": owner_email,
        "owner_uid": owner_uid,
        "feature_flags": {},
        "rate_limits": dict(TRIAL_RATE_LIMITS),
        "branding": {"logo_url": "", "primary_color": "#c2410c", "company_name": name},
        "trial_starts_at": starts,
        "trial_ends_at": ends,
        "quota_enforced": True,
        "createdAt": now,
        "updatedAt": now,
        "notes": notes,
    }


def paid_preset(
    *,
    name: str,
    slug: str,
    owner_email: str,
    owner_uid: str,
    plan: str = TenantPlan.STARTER,
    notes: str = "",
) -> dict[str, Any]:
    now = iso()
    return {
        "id": slug,
        "name": name,
        "slug": slug,
        "status": TenantStatus.ACTIVE,
        "plan": plan or TenantPlan.STARTER,
        "owner_email": owner_email,
        "owner_uid": owner_uid,
        "feature_flags": {},
        "rate_limits": dict(PAID_RATE_LIMITS),
        "branding": {"logo_url": "", "primary_color": "#c2410c", "company_name": name},
        "trial_starts_at": None,
        "trial_ends_at": None,
        "quota_enforced": False,
        "createdAt": now,
        "updatedAt": now,
        "notes": notes,
    }


def is_trial_expired(tenant: dict[str, Any] | None, now: datetime | None = None) -> bool:
    if not tenant or tenant.get("status") != TenantStatus.TRIAL:
        return False
    ends = parse_iso(tenant.get("trial_ends_at"))
    if not ends:
        return False
    return ends <= (now or utcnow())


def days_remaining(tenant: dict[str, Any] | None, now: datetime | None = None) -> int | None:
    if not tenant:
        return None
    ends = parse_iso(tenant.get("trial_ends_at"))
    if not ends:
        return None
    delta = ends - (now or utcnow())
    return max(0, int(delta.total_seconds() // 86400))


class TrialSignupIn(BaseModel):
    company_name: str = Field(min_length=1)
    owner_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)


class ProvisionTenantIn(BaseModel):
    name: str = Field(min_length=1)
    owner_email: str = Field(min_length=3)
    owner_name: str = ""
    company_name: str | None = None
    temporary_password: str | None = None
    trial: bool = True
    plan: str = TenantPlan.STARTER
    notes: str = ""


class ConvertTenantIn(BaseModel):
    to: str = Field(pattern="^(paid|trial)$")
    plan: str = TenantPlan.STARTER


class ExtendTrialIn(BaseModel):
    days: int = 15


class TenantLimitsIn(BaseModel):
    name: str | None = None
    notes: str | None = None
    plan: str | None = None
    status: str | None = None
    quota_enforced: bool | None = None
    rate_limits: dict[str, int] | None = None
    feature_flags: dict[str, Any] | None = None
    branding: dict[str, Any] | None = None


class PlatformUserIn(BaseModel):
    email: str = Field(min_length=3)
    name: str = ""
    role: str = "field"
    roles: list[str] | None = None
    temporary_password: str | None = None


class UpgradeRequestIn(BaseModel):
    message: str = ""
