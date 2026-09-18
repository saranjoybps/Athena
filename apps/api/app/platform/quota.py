from __future__ import annotations

from typing import Any, Literal

from app.core.collections import CUSTOMERS, MEMBERSHIPS, SITES
from app.core.errors import AppError
from app.core.repo import list_org
from app.core.store import DocumentStore, get_store
from app.platform.models import days_remaining, is_trial_expired
from app.platform.store import get_pending_upgrade, get_platform_tenant

QuotaMetric = Literal["users", "customers", "sites"]

_LIMIT_KEYS: dict[QuotaMetric, str] = {
    "users": "max_users",
    "customers": "max_customers",
    "sites": "max_sites",
}


def count_users(org_id: str, store: DocumentStore | None = None) -> int:
    rows = list_org(store or get_store(), MEMBERSHIPS, org_id, limit=10_000)
    n = 0
    for row in rows:
        status = row.get("status") or "active"
        if status in ("active", "invited"):
            n += 1
    return n


def count_customers(org_id: str, store: DocumentStore | None = None) -> int:
    return len(list_org(store or get_store(), CUSTOMERS, org_id, limit=10_000))


def count_sites(org_id: str, store: DocumentStore | None = None) -> int:
    return len(list_org(store or get_store(), SITES, org_id, limit=10_000))


def usage_for(org_id: str, store: DocumentStore | None = None) -> dict[str, int]:
    db = store or get_store()
    return {
        "users": count_users(org_id, db),
        "customers": count_customers(org_id, db),
        "sites": count_sites(org_id, db),
    }


def limits_from_tenant(tenant: dict[str, Any] | None) -> dict[str, int]:
    rates = (tenant or {}).get("rate_limits") or {}
    return {
        "users": int(rates.get("max_users") or 0),
        "customers": int(rates.get("max_customers") or 0),
        "sites": int(rates.get("max_sites") or 0),
    }


def assert_quota(org_id: str, metric: QuotaMetric, store: DocumentStore | None = None) -> None:
    """Enforce platform caps. Missing tenant row is a no-op. 0 = unlimited."""
    db = store or get_store()
    tenant = get_platform_tenant(org_id, db)
    if not tenant:
        return
    cap = limits_from_tenant(tenant).get(metric, 0)
    if cap <= 0:
        return
    current = usage_for(org_id, db).get(metric, 0)
    if current >= cap:
        raise AppError(
            403,
            "quota_exceeded",
            "Account limit reached",
            {"metric": metric, "cap": cap, "usage": current},
        )


def entitlements_payload(org_id: str | None, store: DocumentStore | None = None) -> dict[str, Any] | None:
    if not org_id:
        return None
    db = store or get_store()
    tenant = get_platform_tenant(org_id, db)
    if not tenant:
        return None
    usage = usage_for(org_id, db)
    pending = get_pending_upgrade(org_id, db)
    expired = is_trial_expired(tenant)
    return {
        "status": tenant.get("status"),
        "plan": tenant.get("plan"),
        "trial_ends_at": tenant.get("trial_ends_at"),
        "trial_expired": expired,
        "quota_enforced": bool(tenant.get("quota_enforced")),
        "read_only": False,
        "limits": limits_from_tenant(tenant),
        "usage": usage,
        "upgrade_request_pending": bool(pending),
        "days_remaining": days_remaining(tenant),
    }
