from typing import Any

from app.core.collections import ORGANIZATIONS, USAGE
from app.core.errors import AppError
from app.core.store import DocumentStore

PLAN_ENTITLEMENTS: dict[str, dict[str, Any]] = {
    "free": {
        "maxUsers": 5,
        "maxActiveProjects": 10,
        "branches": False,
        "ai": False,
        "customerPortal": False,
        "advancedPermissions": False,
    },
    "starter": {
        "maxUsers": 3,
        "maxActiveProjects": 10,
        "branches": False,
        "ai": False,
        "customerPortal": False,
        "advancedPermissions": False,
    },
    "professional": {
        "maxUsers": 15,
        "maxActiveProjects": 100,
        "branches": False,
        "ai": False,
        "customerPortal": True,
        "advancedPermissions": False,
    },
    "business": {
        "maxUsers": 100,
        "maxActiveProjects": None,
        "branches": True,
        "ai": True,
        "customerPortal": True,
        "advancedPermissions": True,
    },
    "enterprise": {
        "maxUsers": None,
        "maxActiveProjects": None,
        "branches": True,
        "ai": True,
        "customerPortal": True,
        "advancedPermissions": True,
        "api": True,
    },
}


def entitlements_for(org: dict[str, Any]) -> dict[str, Any]:
    plan = (org.get("plan") or "starter").lower()
    base = dict(PLAN_ENTITLEMENTS.get(plan, PLAN_ENTITLEMENTS["starter"]))
    overrides = org.get("entitlementOverrides") or {}
    base.update(overrides)
    return base


def require_entitlement(org: dict[str, Any], feature: str) -> None:
    ents = entitlements_for(org)
    if not ents.get(feature):
        raise AppError(402, "plan_limit", "Plan does not include this feature.", {"feature": feature})


def check_limit(store: DocumentStore, org_id: str, metric: str, current: int) -> None:
    org = store.get(ORGANIZATIONS, org_id) or {}
    ents = entitlements_for(org)
    mapping = {"users": "maxUsers", "activeProjects": "maxActiveProjects"}
    key = mapping.get(metric)
    if not key:
        return
    cap = ents.get(key)
    if cap is None:
        return
    if current >= cap:
        raise AppError(402, "plan_limit", "Plan limit reached.", {"metric": metric, "cap": cap})


def track_usage(store: DocumentStore, org_id: str, metric: str, amount: int = 1) -> None:
    key = f"{org_id}:{metric}"
    existing = store.get(USAGE, key) or {"orgId": org_id, "metric": metric, "value": 0}
    existing["value"] = int(existing.get("value") or 0) + amount
    store.set(USAGE, key, existing)
