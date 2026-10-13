from __future__ import annotations

from typing import Any, Literal

from app.core.collections import CUSTOMERS, MEMBERSHIPS, SITES
from app.core.concurrency import run_parallel
from app.core.errors import AppError
from app.core.store import DocumentStore, get_store
from app.platform.models import days_remaining, is_trial_expired
from app.platform.store import get_pending_upgrade, get_platform_tenant

QuotaMetric = Literal["users", "customers", "sites"]
_UNSET = object()

_LIMIT_KEYS: dict[QuotaMetric, str] = {
    "users": "max_users",
    "customers": "max_customers",
    "sites": "max_sites",
}


def _org_rows_for_count(store: DocumentStore, collection: str, org_id: str, fields: list[str]) -> list[dict[str, Any]]:
    """Same rows as list_org(limit=10_000), projected to the fields a count needs."""
    rows = store.query(
        collection,
        filters=[("orgId", "==", org_id)],
        order_by="-createdAt",
        limit=10_000,
        fields=fields,
    )
    return [r for r in rows if not r.get("deletedAt")]


def count_users(org_id: str, store: DocumentStore | None = None) -> int:
    rows = _org_rows_for_count(store or get_store(), MEMBERSHIPS, org_id, ["deletedAt", "status"])
    n = 0
    for row in rows:
        status = row.get("status") or "active"
        if status in ("active", "invited"):
            n += 1
    return n


def count_customers(org_id: str, store: DocumentStore | None = None) -> int:
    return len(_org_rows_for_count(store or get_store(), CUSTOMERS, org_id, ["deletedAt"]))


def count_sites(org_id: str, store: DocumentStore | None = None) -> int:
    return len(_org_rows_for_count(store or get_store(), SITES, org_id, ["deletedAt"]))


def usage_for(org_id: str, store: DocumentStore | None = None) -> dict[str, int]:
    db = store or get_store()
    users, customers, sites = run_parallel(
        lambda: count_users(org_id, db),
        lambda: count_customers(org_id, db),
        lambda: count_sites(org_id, db),
    )
    return {"users": users, "customers": customers, "sites": sites}


def limits_from_tenant(tenant: dict[str, Any] | None) -> dict[str, int]:
    rates = (tenant or {}).get("rate_limits") or {}
    return {
        "users": int(rates.get("max_users") or 0),
        "customers": int(rates.get("max_customers") or 0),
        "sites": int(rates.get("max_sites") or 0),
    }


def assert_quota(org_id: str, metric: QuotaMetric, store: DocumentStore | None = None) -> None:
    """Enforce platform caps from rate_limits.

    Rules:
      - Missing platform_tenants row → no-op (legacy orgs).
      - max_* <= 0 → unlimited for that metric.
      - Positive max_* always enforces (trial presets and admin overrides on paid).
      - When quota_enforced is False and all max_* are 0 → fully open (paid default).
    """
    db = store or get_store()
    tenant = get_platform_tenant(org_id, db)
    if not tenant:
        return
    limits = limits_from_tenant(tenant)
    if not tenant.get("quota_enforced") and all(v <= 0 for v in limits.values()):
        return
    cap = limits.get(metric, 0)
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


def entitlements_payload(
    org_id: str | None,
    store: DocumentStore | None = None,
    tenant: dict[str, Any] | None | object = _UNSET,
) -> dict[str, Any] | None:
    """``tenant`` may be passed when the caller already read the platform_tenants row."""
    if not org_id:
        return None
    db = store or get_store()
    if tenant is _UNSET:
        tenant = get_platform_tenant(org_id, db)
    if not tenant:
        return None
    users, customers, sites, pending = run_parallel(
        lambda: count_users(org_id, db),
        lambda: count_customers(org_id, db),
        lambda: count_sites(org_id, db),
        lambda: get_pending_upgrade(org_id, db),
    )
    usage = {"users": users, "customers": customers, "sites": sites}
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
