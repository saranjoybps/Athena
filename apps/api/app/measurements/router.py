from fastapi import APIRouter, Depends

from app.core.collections import FORMULA_TEMPLATES, MEASUREMENTS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, stamp_new
from app.core.store import get_store
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
