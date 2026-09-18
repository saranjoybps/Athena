from __future__ import annotations

import re
import secrets
import string
import uuid
from datetime import timedelta
from typing import Any

from app.core.collections import MEMBERSHIPS, ORGANIZATIONS, USERS
from app.core.errors import AppError
from app.core.membership_cache import invalidate_membership_cache
from app.core.repo import now_iso, stamp_new
from app.core.store import DocumentStore, get_store
from app.platform.identity import create_auth_user, create_or_get_auth_user, set_org_claims
from app.platform.models import (
    PAID_RATE_LIMITS,
    TRIAL_RATE_LIMITS,
    TenantPlan,
    TenantStatus,
    iso,
    paid_preset,
    parse_iso,
    trial_preset,
    trial_window,
    utcnow,
)
from app.platform.quota import assert_quota, entitlements_payload, usage_for
from app.platform.store import (
    get_pending_upgrade,
    get_platform_tenant,
    list_platform_tenants,
    set_platform_tenant,
    set_upgrade_request,
    update_platform_tenant,
)


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:40] or uuid.uuid4().hex[:8]


def _password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def sync_org_plan(store: DocumentStore, org_id: str, plan: str) -> None:
    org = store.get(ORGANIZATIONS, org_id)
    if not org:
        return
    org["plan"] = plan
    org["updatedAt"] = now_iso()
    store.set(ORGANIZATIONS, org_id, org)


def ensure_trial_platform_row(
    store: DocumentStore,
    *,
    org_id: str,
    name: str,
    owner_email: str,
    owner_uid: str,
    provisioned_by: str = "self-onboarding",
) -> dict[str, Any]:
    existing = get_platform_tenant(org_id, store)
    if existing:
        return existing
    record = trial_preset(name=name, slug=org_id, owner_email=owner_email, owner_uid=owner_uid)
    record["id"] = org_id
    record["provisioned_by"] = provisioned_by
    saved = set_platform_tenant(org_id, record, store)
    sync_org_plan(store, org_id, TenantPlan.FREE)
    return saved


def _seed_org(
    store: DocumentStore,
    *,
    org_id_hint: str | None,
    name: str,
    owner_name: str,
    owner_email: str,
    owner_uid: str,
    plan: str,
) -> dict[str, Any]:
    org = stamp_new(
        "",
        {
            "name": name,
            "ownerName": owner_name,
            "phone": "0000000000",
            "email": owner_email,
            "country": "India",
            "state": "",
            "city": "",
            "pinCode": "",
            "address": "",
            "currency": "INR",
            "timeZone": "Asia/Kolkata",
            "plan": plan,
            "trades": [],
            "numberPrefixes": {
                "invoice": "INV",
                "quote": "QUO",
                "project": "PROJ",
                "estimate": "EST",
                "payment": "PAY",
                "purchase_order": "PO",
            },
        },
    )
    org.pop("orgId", None)
    created = store.create(ORGANIZATIONS, org, doc_id=org_id_hint)
    org_id = created["id"]
    created["orgId"] = org_id
    store.set(ORGANIZATIONS, org_id, created)

    user_doc = store.get(USERS, owner_uid) or {}
    store.set(
        USERS,
        owner_uid,
        {
            **user_doc,
            "id": owner_uid,
            "name": owner_name or user_doc.get("name") or owner_email.split("@")[0],
            "email": owner_email,
            "updatedAt": now_iso(),
            "createdAt": user_doc.get("createdAt") or now_iso(),
        },
    )
    store.create(
        MEMBERSHIPS,
        {
            "orgId": org_id,
            "userId": owner_uid,
            "email": owner_email,
            "roles": ["owner"],
            "status": "active",
            "name": owner_name,
            "createdAt": now_iso(),
        },
        doc_id=f"{owner_uid}_{org_id}",
    )
    invalidate_membership_cache(owner_uid)
    return created


def provision_tenant(
    *,
    name: str,
    owner_email: str,
    owner_name: str = "",
    company_name: str | None = None,
    temporary_password: str | None = None,
    trial: bool = True,
    plan: str = TenantPlan.STARTER,
    notes: str = "",
    provisioned_by: str = "platform",
) -> dict[str, Any]:
    store = get_store()
    display = (company_name or name).strip()
    owner_email = owner_email.strip().lower()
    owner_name = (owner_name or owner_email.split("@")[0]).strip()
    password = (temporary_password or "").strip() or _password()
    slug = _slugify(display)
    if get_platform_tenant(slug, store):
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    uid = create_auth_user(owner_email, password, owner_name)
    org_plan = TenantPlan.FREE if trial else (plan or TenantPlan.STARTER)
    org = _seed_org(
        store,
        org_id_hint=slug,
        name=display,
        owner_name=owner_name,
        owner_email=owner_email,
        owner_uid=uid,
        plan=org_plan,
    )
    org_id = org["id"]
    record = (
        trial_preset(name=display, slug=org_id, owner_email=owner_email, owner_uid=uid, notes=notes)
        if trial
        else paid_preset(
            name=display,
            slug=org_id,
            owner_email=owner_email,
            owner_uid=uid,
            plan=org_plan,
            notes=notes,
        )
    )
    record["provisioned_by"] = provisioned_by
    tenant = set_platform_tenant(org_id, record, store)
    set_org_claims(uid, org_id, "owner")
    return {
        "tenant": tenant,
        "owner": {"uid": uid, "email": owner_email, "org_id": org_id},
        "temporary_password": password,
        "organization": org,
    }


def trial_signup(company_name: str, owner_name: str, email: str, password: str) -> dict[str, Any]:
    result = provision_tenant(
        name=company_name.strip(),
        owner_email=email.strip().lower(),
        owner_name=owner_name.strip(),
        company_name=company_name.strip(),
        temporary_password=password,
        trial=True,
        provisioned_by="trial-signup",
    )
    return {
        "uid": result["owner"]["uid"],
        "orgId": result["owner"]["org_id"],
        "email": result["owner"]["email"],
        "tenant": result["tenant"],
    }


def convert_tenant(org_id: str, to: str, plan: str, by_uid: str) -> dict[str, Any]:
    store = get_store()
    tenant = get_platform_tenant(org_id, store)
    if not tenant:
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    if to == "paid":
        updates = {
            "status": TenantStatus.ACTIVE,
            "plan": plan or TenantPlan.STARTER,
            "quota_enforced": False,
            "rate_limits": {**(tenant.get("rate_limits") or {}), **PAID_RATE_LIMITS},
            "updated_by": by_uid,
        }
    elif to == "trial":
        starts, ends = trial_window()
        updates = {
            "status": TenantStatus.TRIAL,
            "plan": TenantPlan.FREE,
            "quota_enforced": True,
            "rate_limits": {**(tenant.get("rate_limits") or {}), **TRIAL_RATE_LIMITS},
            "trial_starts_at": starts,
            "trial_ends_at": ends,
            "updated_by": by_uid,
        }
    else:
        raise AppError(400, "invalid_convert", "Convert target must be paid or trial.")
    saved = update_platform_tenant(org_id, updates, store)
    sync_org_plan(store, org_id, saved["plan"])
    return saved


def extend_trial(org_id: str, days: int, by_uid: str) -> dict[str, Any]:
    store = get_store()
    tenant = get_platform_tenant(org_id, store)
    if not tenant:
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    days = days if days and days > 0 else 15
    current_end = parse_iso(tenant.get("trial_ends_at")) or utcnow()
    base = current_end if current_end > utcnow() else utcnow()
    new_end = base + timedelta(days=days)
    saved = update_platform_tenant(
        org_id,
        {
            "status": TenantStatus.TRIAL,
            "quota_enforced": True,
            "trial_ends_at": iso(new_end),
            "updated_by": by_uid,
        },
        store,
    )
    return saved


def suspend_tenant(org_id: str, by_uid: str) -> dict[str, Any]:
    if not get_platform_tenant(org_id):
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    return update_platform_tenant(org_id, {"status": TenantStatus.SUSPENDED, "updated_by": by_uid})


def reactivate_tenant(org_id: str, by_uid: str) -> dict[str, Any]:
    tenant = get_platform_tenant(org_id)
    if not tenant:
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    status = TenantStatus.TRIAL if tenant.get("plan") == TenantPlan.FREE else TenantStatus.ACTIVE
    return update_platform_tenant(org_id, {"status": status, "updated_by": by_uid})


def tenant_detail(org_id: str) -> dict[str, Any]:
    tenant = get_platform_tenant(org_id)
    if not tenant:
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    ents = entitlements_payload(org_id) or {}
    pending = get_pending_upgrade(org_id)
    return {
        **tenant,
        "usage": ents.get("usage") or usage_for(org_id),
        "limits": ents.get("limits"),
        "days_remaining": ents.get("days_remaining"),
        "trial_expired": ents.get("trial_expired"),
        "upgrade_request_pending": bool(pending),
        "upgrade_request": pending,
    }


def list_tenants_enriched() -> list[dict[str, Any]]:
    items = []
    for tenant in list_platform_tenants():
        org_id = tenant.get("id") or ""
        ents = entitlements_payload(org_id) or {}
        items.append(
            {
                **tenant,
                "usage": ents.get("usage") or {},
                "limits": ents.get("limits") or {},
                "days_remaining": ents.get("days_remaining"),
                "trial_expired": ents.get("trial_expired"),
                "upgrade_request_pending": ents.get("upgrade_request_pending"),
            }
        )
    return items


def create_tenant_user(
    org_id: str,
    *,
    email: str,
    name: str,
    roles: list[str],
    temporary_password: str | None,
    created_by: str,
) -> dict[str, Any]:
    if not get_platform_tenant(org_id):
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    assert_quota(org_id, "users")
    store = get_store()
    email = email.strip().lower()
    temp = (temporary_password or "").strip() or _password()
    uid = create_or_get_auth_user(email, temp, name)
    set_org_claims(uid, org_id, roles[0] if roles else "field")
    user_doc = store.get(USERS, uid) or {}
    store.set(
        USERS,
        uid,
        {
            **user_doc,
            "id": uid,
            "email": email,
            "name": name or user_doc.get("name") or email.split("@")[0],
            "updatedAt": now_iso(),
            "createdAt": user_doc.get("createdAt") or now_iso(),
        },
    )
    membership = store.create(
        MEMBERSHIPS,
        {
            "orgId": org_id,
            "userId": uid,
            "email": email,
            "roles": roles or ["field"],
            "status": "active",
            "name": name,
            "createdAt": now_iso(),
            "created_by": created_by,
        },
        doc_id=f"{uid}_{org_id}",
    )
    invalidate_membership_cache(uid)
    return {**membership, "temporaryPassword": temp}


def request_upgrade(org_id: str, *, message: str, requested_by: str, email: str | None) -> dict[str, Any]:
    tenant = get_platform_tenant(org_id)
    if not tenant:
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    if tenant.get("status") != TenantStatus.TRIAL and not tenant.get("quota_enforced"):
        raise AppError(403, "upgrade_not_allowed", "Upgrade requests are only available on trial or capped accounts.")
    pending = get_pending_upgrade(org_id)
    if pending:
        return pending
    doc_id = f"{org_id}_{uuid.uuid4().hex[:8]}"
    now = iso()
    return set_upgrade_request(
        doc_id,
        {
            "id": doc_id,
            "org_id": org_id,
            "org_name": tenant.get("name"),
            "owner_email": tenant.get("owner_email") or email,
            "status": "pending",
            "message": message or "",
            "requested_by": requested_by,
            "createdAt": now,
            "updatedAt": now,
        },
    )


def accept_upgrade(request_id: str, by_uid: str) -> dict[str, Any]:
    store = get_store()
    doc = store.get("platform_upgrade_requests", request_id)
    if not doc:
        raise AppError(404, "not_found", "Upgrade request not found.")
    if doc.get("status") != "pending":
        raise AppError(400, "not_pending", "Upgrade request is not pending.")
    org_id = doc["org_id"]
    tenant = convert_tenant(org_id, "paid", TenantPlan.STARTER, by_uid)
    saved = set_upgrade_request(
        request_id,
        {
            **doc,
            "status": "accepted",
            "resolved_at": iso(),
            "resolved_by": by_uid,
        },
        store,
    )
    return {"request": saved, "tenant": tenant}


def reject_upgrade(request_id: str, by_uid: str) -> dict[str, Any]:
    store = get_store()
    doc = store.get("platform_upgrade_requests", request_id)
    if not doc:
        raise AppError(404, "not_found", "Upgrade request not found.")
    if doc.get("status") != "pending":
        raise AppError(400, "not_pending", "Upgrade request is not pending.")
    return set_upgrade_request(
        request_id,
        {
            **doc,
            "status": "rejected",
            "resolved_at": iso(),
            "resolved_by": by_uid,
        },
        store,
    )


def apply_onboarding_platform_row(store: DocumentStore, ctx_user_id: str, result: dict[str, Any]) -> None:
    org = result.get("organization") or {}
    org_id = org.get("id")
    if not org_id:
        return
    ensure_trial_platform_row(
        store,
        org_id=org_id,
        name=org.get("name") or "Workspace",
        owner_email=org.get("email") or "",
        owner_uid=ctx_user_id,
        provisioned_by="self-onboarding",
    )
    set_org_claims(ctx_user_id, org_id, "owner")
