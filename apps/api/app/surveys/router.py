from fastapi import APIRouter, Depends

from app.core.collections import ESTIMATES, MEASUREMENTS, SITE_SURVEYS
from app.core.context import RequestContext, get_ctx
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import get_store
from app.core.audit import write_audit
from app.customers.hierarchy import resolve_site_scope
from app.surveys.schemas import SurveyIn

router = APIRouter(prefix="/surveys", tags=["surveys"])


@router.get("")
def list_surveys(site_id: str | None = None, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SURVEY_READ)
    extra = [("siteId", "==", site_id)] if site_id else None
    return {"items": list_org(get_store(), SITE_SURVEYS, ctx.require_org(), extra)}


@router.post("")
def create_survey(payload: SurveyIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SURVEY_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    site, customer = resolve_site_scope(store, org_id, payload.siteId, payload.customerId)
    data = payload.model_dump()
    data["customerId"] = customer["id"]
    data["number"] = next_number(store, org_id, "survey")
    data["surveyorId"] = data.get("surveyorId") or ctx.user_id
    doc = store.create(SITE_SURVEYS, stamp_new(org_id, data))
    write_audit(store, ctx, "survey.create", "survey", doc["id"], new=doc)
    return doc


@router.get("/{survey_id}")
def get_survey(survey_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SURVEY_READ)
    return org_owned(get_store(), SITE_SURVEYS, survey_id, ctx.require_org())


@router.patch("/{survey_id}")
def update_survey(survey_id: str, payload: SurveyIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SURVEY_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    current = org_owned(store, SITE_SURVEYS, survey_id, org_id)
    fields = payload.model_dump(exclude_unset=True)
    _, customer = resolve_site_scope(store, org_id, fields.get("siteId") or current.get("siteId") or "", fields.get("customerId"))
    fields["customerId"] = customer["id"]
    saved = update_doc(store, SITE_SURVEYS, survey_id, org_id, fields)
    write_audit(store, ctx, "survey.update", "survey", survey_id, previous=current, new=saved)
    return saved


@router.delete("/{survey_id}")
def delete_survey(survey_id: str, ctx: RequestContext = Depends(get_ctx)):
    """Measurements and estimates keep their figures; only their link to this survey is cleared."""
    ctx.require(Permission.SURVEY_CREATE)
    store = get_store()
    org_id = ctx.require_org()
    survey = org_owned(store, SITE_SURVEYS, survey_id, org_id)
    for collection in (MEASUREMENTS, ESTIMATES):
        for row in list_org(store, collection, org_id, extra_filters=[("surveyId", "==", survey_id)], limit=200):
            row["surveyId"] = None
            row["updatedAt"] = now_iso()
            store.set(collection, row["id"], row)
    soft_delete(store, SITE_SURVEYS, survey_id, org_id)
    write_audit(store, ctx, "survey.delete", "survey", survey_id, previous=survey)
    return {"ok": True, "id": survey_id, "siteId": survey.get("siteId"), "customerId": survey.get("customerId")}
