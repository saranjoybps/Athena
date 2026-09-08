from decimal import Decimal

from fastapi import APIRouter, Depends

from app.core.audit import write_audit
from app.core.collections import ESTIMATE_VERSIONS, ESTIMATES, MEASUREMENTS
from app.core.context import RequestContext, get_ctx
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, stamp_new
from app.core.store import get_store
from app.engines.costing import estimate_totals
from app.engines.gst import compute_gst
from app.engines.units import D
from app.estimating.schemas import EstimateIn

router = APIRouter(prefix="/estimates", tags=["estimates"])


def _compute(payload: EstimateIn) -> dict:
    material = sum(D(i.materialCost) for i in payload.items)
    labour = sum(D(i.labourCost) for i in payload.items)
    equipment_items = sum(D(i.equipmentCost) for i in payload.items)
    other_items = sum(D(i.otherCost) for i in payload.items)
    totals = estimate_totals(
        material=material,
        labour=labour,
        equipment=D(payload.equipmentCost) + equipment_items,
        transport=payload.transportCost,
        subcontractor=payload.subcontractorCost,
        other=D(payload.otherCost) + other_items,
        markup_rate=payload.markupRate,
        margin_rate=payload.marginRate,
        discount=payload.discount,
    )
    tax = compute_gst(
        totals["subtotal"],
        payload.taxRate or "0",
        payload.placeOfSupply,
        payload.supplierState,
        payload.registeredCustomer,
    )
    return {**totals, "tax": tax, "grandTotal": tax["grandTotal"]}


@router.get("")
def list_estimates(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_READ)
    return {"items": list_org(get_store(), ESTIMATES, ctx.require_org())}


@router.post("")
def create_estimate(payload: EstimateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    computed = _compute(payload)
    number = next_number(store, org_id, "estimate")
    body = stamp_new(
        org_id,
        {
            **payload.model_dump(),
            "number": number,
            "version": 1,
            "status": "draft",
            "computed": computed,
        },
    )
    if payload.measurementId:
        m = org_owned(store, MEASUREMENTS, payload.measurementId, org_id)
        body["measurementOutputs"] = m.get("outputs")
    doc = store.create(ESTIMATES, body)
    store.create(
        ESTIMATE_VERSIONS,
        {
            "orgId": org_id,
            "estimateId": doc["id"],
            "version": 1,
            "snapshot": doc,
            "userId": ctx.user_id,
            "reason": payload.reason or "created",
            "createdAt": now_iso(),
        },
    )
    write_audit(store, ctx, "estimate.create", "estimate", doc["id"], new=doc)
    return doc


@router.post("/{estimate_id}/versions")
def new_version(estimate_id: str, payload: EstimateIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    existing = org_owned(store, ESTIMATES, estimate_id, org_id)
    computed = _compute(payload)
    version = int(existing.get("version") or 1) + 1
    existing.update(payload.model_dump())
    existing["computed"] = computed
    existing["version"] = version
    existing["updatedAt"] = now_iso()
    saved = store.set(ESTIMATES, estimate_id, existing)
    store.create(
        ESTIMATE_VERSIONS,
        {
            "orgId": org_id,
            "estimateId": estimate_id,
            "version": version,
            "snapshot": saved,
            "userId": ctx.user_id,
            "reason": payload.reason or "revised",
            "createdAt": now_iso(),
        },
    )
    write_audit(store, ctx, "estimate.version", "estimate", estimate_id, new=saved)
    return saved


@router.get("/{estimate_id}")
def get_estimate(estimate_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.ESTIMATE_READ)
    return org_owned(get_store(), ESTIMATES, estimate_id, ctx.require_org())
