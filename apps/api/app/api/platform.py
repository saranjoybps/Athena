from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.audit import forbid_audit_delete
from app.core.collections import AUDIT_LOGS
from app.core.context import RequestContext, get_ctx
from app.core.media import sign_upload
from app.core.permissions import Permission
from app.core.repo import list_org
from app.core.store import get_store
from app.engines.pack_size import procurement_quantity, recommend_packs

extra = APIRouter(tags=["platform"])


class PackIn(BaseModel):
    required: str
    wastage: str = "0.05"
    packSizes: list[str]


@extra.post("/materials/pack-recommendation")
def packs(payload: PackIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.MATERIAL_READ)
    qty = procurement_quantity(payload.required, payload.wastage)
    rec = recommend_packs(qty, payload.packSizes)
    rec["procurementQuantity"] = rec["required"]
    return rec


@extra.post("/media/sign")
def media_sign(folder: str = "fabrica", ctx: RequestContext = Depends(get_ctx)):
    ctx.require_org()
    return sign_upload(f"{folder}/{ctx.org_id}")


@extra.get("/audit")
def list_audit(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SETTINGS_MANAGE)
    return {"items": list_org(get_store(), AUDIT_LOGS, ctx.require_org())}


@extra.delete("/audit/{audit_id}")
def delete_audit(audit_id: str, ctx: RequestContext = Depends(get_ctx)):
    forbid_audit_delete()


@extra.post("/ai/draft")
def ai_draft(kind: str, text: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.AI_USE)
    from app.integrations import ai

    return {**ai.draft(kind, text), "status": "draft", "requiresConfirmation": True}
