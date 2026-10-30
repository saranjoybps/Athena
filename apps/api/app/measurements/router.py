from fastapi import APIRouter, Depends

from app.core.collections import FORMULA_TEMPLATES, MEASUREMENTS, PROJECTS, SITE_SURVEYS
from app.core.context import RequestContext, get_ctx
from app.core.errors import AppError
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.core.audit import write_audit
from app.customers.hierarchy import resolve_site_scope
from app.engines.formulas import evaluate
from app.engines.scope_measurements import SCOPE_TYPES, compute_scope
from app.measurements.schemas import MeasurementIn

router = APIRouter(prefix="/measurements", tags=["measurements"])


def _scope_kind(payload_kind: str | None, formula_kind: str | None) -> str | None:
    for candidate in (payload_kind, formula_kind):
        kind = str(candidate or "").strip().lower()
        if kind in SCOPE_TYPES:
            return kind
    return None


def _apply_scope(fields: dict, current: dict | None = None) -> None:
    """Replace client-supplied outputs for the five scope types with the engine result."""
    current = current or {}
    kind = _scope_kind(fields.get("measurementType"), fields.get("formulaKind") or current.get("formulaKind"))
    if not kind and "inputs" not in fields and "measurementType" not in fields:
        return
    if not kind:
        kind = _scope_kind(current.get("measurementType"), current.get("formulaKind"))
    if not kind:
        return
    inputs = fields.get("inputs") if "inputs" in fields else current.get("inputs") or {}
    outputs = compute_scope(kind, inputs if isinstance(inputs, dict) else {})
    fields["measurementType"] = kind
    fields["formulaKind"] = kind
    fields["inputs"] = inputs
    fields["outputs"] = outputs
    fields["originalValue"] = inputs
    fields["originalUnit"] = outputs.get("unit") or fields.get("originalUnit") or current.get("originalUnit")
    config = dict(fields.get("formulaConfig") or current.get("formulaConfig") or {})
    config.pop("outputs", None)
    fields["formulaConfig"] = config


def _check_project(store, org_id: str, project_id: str | None, site_id: str) -> None:
    if not project_id:
        return
    project = org_owned(store, PROJECTS, project_id, org_id)
    if str(project.get("siteId") or "") != site_id:
        raise AppError(400, "measurement_project_mismatch", "The selected project belongs to a different site.")


def _check_survey(store, org_id: str, survey_id: str | None, site_id: str) -> None:
    if not survey_id:
        return
    survey = org_owned(store, SITE_SURVEYS, survey_id, org_id)
    if str(survey.get("siteId") or "") != site_id:
        raise AppError(400, "survey_site_mismatch", "The selected survey belongs to a different site.")


@router.get("")
def list_measurements(site_id: str | None = None, project_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_READ)
    extra = []
    if site_id:
        extra.append(("siteId", "==", site_id))
    if project_id:
        extra.append(("projectId", "==", project_id))
    return {"items": list_org(get_store(), MEASUREMENTS, ctx.require_org(), extra or None)}


@router.post("/preview")
def preview_measurement(payload: MeasurementIn, ctx: RequestContext = Depends(get_ctx)):
    """Calculate a scope measurement without saving it."""
    ctx.require(Permission.MEASUREMENT_READ)
    kind = _scope_kind(payload.measurementType, payload.formulaKind)
    if not kind:
        raise AppError(422, "unknown_measurement_type", "Preview is for area, quantity, length, time or fixed measurements.")
    return compute_scope(kind, payload.inputs)


@router.post("")
def create_measurement(payload: MeasurementIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    _, customer = resolve_site_scope(store, org_id, payload.siteId, payload.customerId)
    _check_survey(store, org_id, payload.surveyId, payload.siteId)
    _check_project(store, org_id, payload.projectId, payload.siteId)
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
    _apply_scope(doc)
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
    _check_survey(store, org_id, fields.get("surveyId", current.get("surveyId")), site_id)
    _check_project(store, org_id, fields.get("projectId", current.get("projectId")), site_id)
    if _scope_kind(fields.get("measurementType") or current.get("measurementType"), fields.get("formulaKind") or current.get("formulaKind")):
        _apply_scope(fields, current)
    elif "inputs" in fields or "formulaKind" in fields or "formulaConfig" in fields:
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
