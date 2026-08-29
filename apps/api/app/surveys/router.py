from fastapi import APIRouter, Depends

from app.core.collections import SITE_SURVEYS
from app.core.context import RequestContext, get_ctx
from app.core.numbering import next_number
from app.core.permissions import Permission
from app.core.repo import list_org, org_owned, stamp_new
from app.core.store import get_store
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
    data = payload.model_dump()
    data["number"] = next_number(store, org_id, "survey")
    data["surveyorId"] = data.get("surveyorId") or ctx.user_id
    return store.create(SITE_SURVEYS, stamp_new(org_id, data))


@router.get("/{survey_id}")
def get_survey(survey_id: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SURVEY_READ)
    return org_owned(get_store(), SITE_SURVEYS, survey_id, ctx.require_org())
