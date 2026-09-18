from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.collections import CUSTOMERS, DELIVERY_CHALLANS, PROJECTS
from app.core.context import RequestContext, get_ctx
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new, update_doc
from app.core.store import get_store
from app.schemas.operations import DeliveryChallanIn, DeliveryChallanUpdate

router = APIRouter(prefix="/delivery-challans", tags=["delivery-challans"])


def _enrich(store, org_id: str, doc: dict) -> dict:
    out = dict(doc)
    customer_id = doc.get("customerId")
    if customer_id:
        cust = store.get(CUSTOMERS, customer_id) or {}
        if cust.get("orgId") == org_id:
            out["customer"] = {"id": customer_id, "name": cust.get("name"), "phone": cust.get("phone")}
    project_id = doc.get("projectId")
    if project_id:
        proj = store.get(PROJECTS, project_id) or {}
        if proj.get("orgId") == org_id:
            out["project"] = {"id": project_id, "name": proj.get("name") or proj.get("title")}
    return out


@router.post("")
def create_delivery_challan(payload: DeliveryChallanIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, CUSTOMERS, payload.customerId, org_id)
    if payload.projectId:
        org_owned(store, PROJECTS, payload.projectId, org_id)
    data = payload.model_dump()
    data["number"] = next_number(store, org_id, "delivery_challan")
    data["status"] = data.get("status") or "draft"
    data["date"] = data.get("date") or now_iso()[:10]
    doc = store.create(DELIVERY_CHALLANS, stamp_new(org_id, data))
    return _enrich(store, org_id, doc)


@router.get("")
def list_delivery_challans(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    items = list_org(store, DELIVERY_CHALLANS, org_id)
    return {"items": [_enrich(store, org_id, i) for i in items]}


@router.get("/{challan_id}")
def get_delivery_challan(challan_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    doc = org_owned(store, DELIVERY_CHALLANS, challan_id, org_id)
    return _enrich(store, org_id, doc)


@router.patch("/{challan_id}")
def update_delivery_challan(challan_id: str, payload: DeliveryChallanUpdate, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    org_owned(store, DELIVERY_CHALLANS, challan_id, org_id)
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "customerId" in patch:
        org_owned(store, CUSTOMERS, patch["customerId"], org_id)
    if patch.get("projectId"):
        org_owned(store, PROJECTS, patch["projectId"], org_id)
    doc = update_doc(store, DELIVERY_CHALLANS, challan_id, org_id, patch)
    return _enrich(store, org_id, doc)


@router.post("/{challan_id}/pdf")
def generate_delivery_challan_pdf(challan_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.INVOICE_READ)
    store = get_store()
    org_id = ctx.require_org()
    doc = _enrich(store, org_id, org_owned(store, DELIVERY_CHALLANS, challan_id, org_id))
    from app.core.media import upload_document_pdf

    pdf = upload_document_pdf(doc, kind="challan", org_id=org_id, doc_id=challan_id)
    updated = update_doc(store, DELIVERY_CHALLANS, challan_id, org_id, pdf)
    return _enrich(store, org_id, updated)
