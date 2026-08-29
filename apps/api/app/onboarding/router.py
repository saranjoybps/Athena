from fastapi import APIRouter, Depends

from app.core.context import RequestContext, get_ctx
from app.core.store import get_store
from app.onboarding.service import OnboardingPayload, onboard

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("")
def complete_onboarding(payload: OnboardingPayload, ctx: RequestContext = Depends(get_ctx)):
    return onboard(get_store(), ctx, payload)
