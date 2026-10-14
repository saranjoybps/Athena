from fastapi import APIRouter, Depends

from app.core.collections import FORMULA_TEMPLATES, MEASUREMENTS, SITE_SURVEYS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.core.audit import write_audit
from app.customers.hierarchy import resolve_site_scope
from app.engines.formulas import evaluate
from app.measurements.schemas import MeasurementIn

router = APIRouter(prefix="/measurements", tags=["measurements"])


def _check_survey(store, org_id: str, survey_id: str | None, site_id: str) -> None:
    if not survey_id:
        return
    survey = org_owned(store, SITE_SURVEYS, survey_id, org_id)
    if str(survey.get("siteId") or "") != site_id:
        raise AppError(400, "survey_site_mismatch", "The selected survey belongs to a different site.")


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
    _, customer = resolve_site_scope(store, org_id, payload.siteId, payload.customerId)
    _check_survey(store, org_id, payload.surveyId, payload.siteId)
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
            "customerId": customer["id"],
            "outputs": outputs,
            "originalValue": payload.inputs,
            "originalUnit": payload.originalUnit,
        },
    )
    saved = store.create(MEASUREMENTS, doc)
    write_audit(store, ctx, "measurement.create", "measurement", saved["id"], new=saved)
    return saved


@router.get("/{measurement_id}")
def get_measurement(measurement_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_READ)
    return org_owned(get_store(), MEASUREMENTS, measurement_id, ctx.require_org())


@router.patch("/{measurement_id}")
def update_measurement(measurement_id: str, payload: MeasurementIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    current = org_owned(store, MEASUREMENTS, measurement_id, org_id)
    fields = payload.model_dump(exclude_unset=True)
    site_id = fields.get("siteId") or current.get("siteId") or ""
    _, customer = resolve_site_scope(store, org_id, site_id, fields.get("customerId"))
    fields["customerId"] = customer["id"]
    _check_survey(store, org_id, fields.get("surveyId"), site_id)
    if "inputs" in fields or "formulaKind" in fields or "formulaConfig" in fields:
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


@router.delete("/{measurement_id}")
def delete_measurement(measurement_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Estimates copy quantities when lines are added, so they are unaffected."""
    ctx.require(Permission.MEASUREMENT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    current = org_owned(store, MEASUREMENTS, measurement_id, org_id)
    soft_delete(store, MEASUREMENTS, measurement_id, org_id)
    write_audit(store, ctx, "measurement.delete", "measurement", measurement_id, previous=current)
    return {"ok": True, "id": measurement_id, "siteId": current.get("siteId"), "customerId": current.get("customerId")}
