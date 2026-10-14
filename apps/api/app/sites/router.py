from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.audit import write_audit
from app.core.collections import CUSTOMERS, DOCUMENTS, SITES
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.customers.hierarchy import delete_site_cascade
from app.sites.schemas import SiteIn

router = APIRouter(prefix="/sites", tags=["sites"])


class SiteFileIn(BaseModel):
    name: str
    url: str
    category: str = "site_proof"
    publicId: str | None = None
    resourceType: str | None = None
    mimeType: str | None = None
    bytes: int | None = None


@router.get("")
def list_sites(customer_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_READ)
    org_id = ctx.require_org()
    extra = [("customerId", "==", customer_id)] if customer_id else None
    return {"items": list_org(get_store(), SITES, org_id, extra, limit=500)}


@router.post("")
def create_site(payload: SiteIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, CUSTOMERS, payload.customerId, org_id)
    from app.platform.quota import assert_quota

    assert_quota(org_id, "sites")
    doc = store.create(SITES, stamp_new(org_id, payload.model_dump()))
    write_audit(store, ctx, "site.create", "site", doc["id"], new=doc)
    return doc


@router.get("/{site_id}/files")
def list_site_files(site_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_READ)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, SITES, site_id, org_id)
    items = list_org(store, DOCUMENTS, org_id, extra_filters=[("siteId", "==", site_id)], limit=100)
    return {"items": items}


@router.post("/{site_id}/files")
def create_site_file(site_id: str, payload: SiteFileIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    site = org_owned(store, SITES, site_id, org_id)
    doc = store.create(
        DOCUMENTS,
        stamp_new(
            org_id,
            {
                **payload.model_dump(),
                "siteId": site_id,
                "customerId": site.get("customerId"),
                "projectId": None,
                "uploadedBy": ctx.user_id,
            },
        ),
    )
    write_audit(store, ctx, "site.file.create", "document", doc["id"], new=doc)
    return doc


@router.delete("/{site_id}/files/{file_id}")
def delete_site_file(site_id: str, file_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, SITES, site_id, org_id)
    doc = org_owned(store, DOCUMENTS, file_id, org_id)
    if str(doc.get("siteId") or "") != site_id:
        raise AppError(404, "not_found", "File not found on this site.")
    soft_delete(store, DOCUMENTS, file_id, org_id)
    write_audit(store, ctx, "site.file.delete", "document", file_id, previous=doc)
    return {"ok": True, "id": file_id}


@router.get("/{site_id}")
def get_site(site_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_READ)
    return org_owned(get_store(), SITES, site_id, ctx.require_org())


@router.patch("/{site_id}")
def update_site(site_id: str, payload: SiteIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SITE_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    current = org_owned(store, SITES, site_id, org_id)
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("customerId") and fields["customerId"] != current.get("customerId"):
        raise AppError(400, "site_customer_locked", "A site can't be moved to a different customer.")
    saved = update_doc(store, SITES, site_id, org_id, fields)
    write_audit(store, ctx, "site.update", "site", site_id, previous=current, new=saved)
    return saved


@router.delete("/{site_id}")
def delete_site(site_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Soft-deletes the site with its surveys, measurements, estimates, quotes and files.
    Refused while the site has projects or invoices."""
    ctx.require(Permission.SITE_UPDATE)
    store = get_store()
    org_id = ctx.require_org()
    site = org_owned(store, SITES, site_id, org_id)
    removed = delete_site_cascade(store, org_id, site)
    write_audit(store, ctx, "site.delete", "site", site_id, previous=site, new={"removed": removed})
    return {"ok": True, "id": site_id, "customerId": site.get("customerId"), "removed": removed}
