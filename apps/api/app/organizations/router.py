from fastapi import APIRouter, Depends

from app.billing.document_service import org_document_branding
from app.billing.schemas import DocumentBrandingIn
from app.core.audit import write_audit
from app.core.collections import ORGANIZATIONS
from app.core.context import RequestContext, get_ctx
from app.core.entitlements import entitlements_for
from app.core.permissions import Permission
from app.core.repo import now_iso, org_owned
from app.core.store import get_store

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/current")
def current(ctx: RequestContext = Depends(get_ctx)):
    org_id = ctx.require_org()
    org = org_owned(get_store(), ORGANIZATIONS, org_id, org_id)
    ctx.require(Permission.SETTINGS_MANAGE)
    return {**org, "entitlements": entitlements_for(org)}


@router.get("/current/document-branding")
def document_branding(ctx: RequestContext = Depends(get_ctx)):
    org_id = ctx.require_org()
    ctx.require(Permission.INVOICE_READ)
    org = org_owned(get_store(), ORGANIZATIONS, org_id, org_id)
    return org_document_branding(org)


@router.patch("/current/document-branding")
def update_document_branding(payload: DocumentBrandingIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SETTINGS_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    org = org_owned(store, ORGANIZATIONS, org_id, org_id)
    branding = org.get("documentBranding") or {}
    updates = payload.model_dump(exclude_unset=True)
    branding.update(updates)
    org["documentBranding"] = branding
    org["updatedAt"] = now_iso()
    saved = store.set(ORGANIZATIONS, org_id, org)
    write_audit(store, ctx, "organization.update_branding", "organization", org_id, new=saved)
    return org_document_branding(saved)
