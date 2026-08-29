from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.engines.formulas import evaluate

router = APIRouter(prefix="/formulas", tags=["formulas"])


class EvalIn(BaseModel):
    kind: str
    inputs: dict
    config: dict = {}


@router.post("/evaluate")
def eval_formula(payload: EvalIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MEASUREMENT_CREATE)
    return evaluate(payload.kind, payload.inputs, payload.config)
