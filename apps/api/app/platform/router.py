from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.collections import MEMBERSHIPS, USERS
from app.core.context import RequestContext, get_platform_admin
from app.core.errors import AppError
from app.core.repo import list_org, now_iso
from app.core.store import get_store
from app.platform import service
from app.platform.models import ConvertTenantIn, ExtendTrialIn, PlatformUserIn, ProvisionTenantIn, TenantLimitsIn
from app.platform.quota import usage_for
from app.platform.store import get_app_settings, list_upgrade_requests, set_app_settings
from app.users.router import _normalize_roles

router = APIRouter(prefix="/platform", tags=["platform-admin"])


@router.get("/tenants")
def list_tenants(_admin: RequestContext = Depends(get_platform_admin)):
    return {"items": service.list_tenants_enriched()}


@router.post("/tenants")
def create_tenant(payload: ProvisionTenantIn, admin: RequestContext = Depends(get_platform_admin)):
    return service.provision_tenant(
        name=payload.name,
        owner_email=payload.owner_email,
        owner_name=payload.owner_name,
        company_name=payload.company_name,
        temporary_password=payload.temporary_password,
        trial=payload.trial,
        plan=payload.plan,
        notes=payload.notes,
        provisioned_by=admin.user_id,
    )


@router.get("/tenants/{tenant_id}")
def get_tenant(tenant_id: str, _admin: RequestContext = Depends(get_platform_admin)):
    return service.tenant_detail(tenant_id)


@router.patch("/tenants/{tenant_id}")
def patch_tenant(tenant_id: str, payload: TenantLimitsIn, admin: RequestContext = Depends(get_platform_admin)):
    from app.platform.store import get_platform_tenant, update_platform_tenant

    if not get_platform_tenant(tenant_id):
        raise AppError(404, "tenant_not_found", "Tenant not found.")
    updates = payload.model_dump(exclude_unset=True)
    updates["updated_by"] = admin.user_id
    saved = update_platform_tenant(tenant_id, updates)
    if payload.plan:
        service.sync_org_plan(get_store(), tenant_id, payload.plan)
    detail = service.tenant_detail(tenant_id)
    detail.update(saved)
    return detail


@router.post("/tenants/{tenant_id}/suspend")
def suspend(tenant_id: str, admin: RequestContext = Depends(get_platform_admin)):
    return service.suspend_tenant(tenant_id, admin.user_id)


@router.post("/tenants/{tenant_id}/reactivate")
def reactivate(tenant_id: str, admin: RequestContext = Depends(get_platform_admin)):
    return service.reactivate_tenant(tenant_id, admin.user_id)


@router.post("/tenants/{tenant_id}/convert")
def convert(tenant_id: str, payload: ConvertTenantIn, admin: RequestContext = Depends(get_platform_admin)):
    return service.convert_tenant(tenant_id, payload.to, payload.plan, admin.user_id)


@router.post("/tenants/{tenant_id}/extend-trial")
def extend(tenant_id: str, payload: ExtendTrialIn, admin: RequestContext = Depends(get_platform_admin)):
    return service.extend_trial(tenant_id, payload.days, admin.user_id)


@router.get("/tenants/{tenant_id}/users")
def list_users(tenant_id: str, _admin: RequestContext = Depends(get_platform_admin)):
    store = get_store()
    items = []
    for m in list_org(store, MEMBERSHIPS, tenant_id, limit=500):
        user = store.get(USERS, m.get("userId") or "") if m.get("userId") else None
        items.append(
            {
                **m,
                "name": m.get("name") or (user or {}).get("name"),
                "email": m.get("email") or (user or {}).get("email"),
            }
        )
    return {"items": items, "usage": usage_for(tenant_id)}


@router.post("/tenants/{tenant_id}/users")
def create_user(tenant_id: str, payload: PlatformUserIn, admin: RequestContext = Depends(get_platform_admin)):
    roles = _normalize_roles(payload.roles, payload.role)
    return service.create_tenant_user(
        tenant_id,
        email=payload.email,
        name=payload.name,
        roles=roles,
        temporary_password=payload.temporary_password,
        created_by=admin.user_id,
    )


@router.patch("/tenants/{tenant_id}/users/{membership_id}")
def update_user(
    tenant_id: str,
    membership_id: str,
    payload: PlatformUserIn,
    _admin: RequestContext = Depends(get_platform_admin),
):
    store = get_store()
    membership = store.get(MEMBERSHIPS, membership_id)
    if not membership or membership.get("orgId") != tenant_id:
        raise AppError(404, "not_found", "User membership not found.")
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("roles") or fields.get("role"):
        membership["roles"] = _normalize_roles(fields.get("roles"), fields.get("role"))
    if payload.name:
        membership["name"] = payload.name
    if payload.email:
        membership["email"] = payload.email.strip().lower()
    membership["updatedAt"] = now_iso()
    return store.set(MEMBERSHIPS, membership_id, membership)


@router.delete("/tenants/{tenant_id}/users/{membership_id}")
def delete_user(tenant_id: str, membership_id: str, _admin: RequestContext = Depends(get_platform_admin)):
    store = get_store()
    membership = store.get(MEMBERSHIPS, membership_id)
    if not membership or membership.get("orgId") != tenant_id:
        raise AppError(404, "not_found", "User membership not found.")
    membership["deletedAt"] = now_iso()
    membership["status"] = "disabled"
    store.set(MEMBERSHIPS, membership_id, membership)
    return {"ok": True, "id": membership_id}


@router.get("/upgrade-requests")
def list_pending(_admin: RequestContext = Depends(get_platform_admin), status: str = "pending"):
    items = list_upgrade_requests(status=status if status != "all" else None)
    return {"items": items, "pending_count": len([i for i in items if i.get("status") == "pending"])}


@router.post("/upgrade-requests/{request_id}/accept")
def accept(request_id: str, admin: RequestContext = Depends(get_platform_admin)):
    return service.accept_upgrade(request_id, admin.user_id)


@router.post("/upgrade-requests/{request_id}/reject")
def reject(request_id: str, admin: RequestContext = Depends(get_platform_admin)):
    return service.reject_upgrade(request_id, admin.user_id)


@router.get("/settings")
def settings_get(_admin: RequestContext = Depends(get_platform_admin)):
    return get_app_settings()


@router.put("/settings")
def settings_put(payload: dict, admin: RequestContext = Depends(get_platform_admin)):
    return set_app_settings(payload, admin.user_id)
