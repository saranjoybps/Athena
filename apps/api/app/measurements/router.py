from fastapi import APIRouter, Depends

from app.core.collections import FORMULA_TEMPLATES, MEASUREMENTS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, stamp_new, update_doc
from app.core.store import get_store
from app.core.audit import write_audit
from app.engines.formulas import evaluate
from app.measurements.schemas import MeasurementIn

router = APIRouter(prefix="/measurements", tags=["measurements"])


@router.get("")
def list_measurements(site_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_READ)
    extra = [("siteId", "==", site_id)] if site_id else None
    return {"items": list_org(get_store(), MEASUREMENTS, ctx.require_org(), extra)}


@router.post("")
def create_measurement(payload: MeasurementIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    config = dict(payload.formulaConfig)
    tpls = store.query(FORMULA_TEMPLATES, filters=[("orgId", "==", org_id), ("kind", "==", payload.formulaKind)], limit=1)
    if tpls and tpls[0].get("config"):
        merged = dict(tpls[0]["config"])
        merged.update(config)
        config = merged
    outputs = evaluate(payload.formulaKind, payload.inputs, config)
    doc = stamp_new(
        org_id,
        {
            **payload.model_dump(),
            "outputs": outputs,
            "originalValue": payload.inputs,
            "originalUnit": payload.originalUnit,
        },
    )
    return store.create(MEASUREMENTS, doc)


@router.get("/{measurement_id}")
def get_measurement(measurement_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_READ)
    return org_owned(get_store(), MEASUREMENTS, measurement_id, ctx.require_org())


@router.patch("/{measurement_id}")
def update_measurement(measurement_id: str, payload: MeasurementIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    fields = payload.model_dump(exclude_unset=True)
    if "inputs" in fields or "formulaKind" in fields or "formulaConfig" in fields:
        current = org_owned(store, MEASUREMENTS, measurement_id, org_id)
        kind = fields.get("formulaKind") or current.get("formulaKind") or "painting"
        inputs = fields.get("inputs") or current.get("inputs") or {}
        config = dict(fields.get("formulaConfig") or current.get("formulaConfig") or {})
        tpls = store.query(FORMULA_TEMPLATES, filters=[("orgId", "==", org_id), ("kind", "==", kind)], limit=1)
        if tpls and tpls[0].get("config"):
            merged = dict(tpls[0]["config"])
            merged.update(config)
            config = merged
        fields["outputs"] = evaluate(kind, inputs, config)
        fields["originalValue"] = inputs
    saved = update_doc(store, MEASUREMENTS, measurement_id, org_id, fields)
    write_audit(store, ctx, "measurement.update", "measurement", measurement_id, new=saved)
    return saved
