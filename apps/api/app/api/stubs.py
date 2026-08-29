from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, create_model

from app.core.context import RequestContext, get_ctx
from app.core.repo import list_org, stamp_new
from app.core.store import get_store


def stub_router(
    prefix: str,
    collection: str,
    tag: str,
    permission: str,
    fields: dict[str, tuple[type, Any]],
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])
    Schema = create_model(f"{tag.title().replace('_','')}In", **fields)

    @router.get("")
    def list_items(ctx: RequestContext = Depends(get_ctx)):
        ctx.require(permission)
        return {"items": list_org(get_store(), collection, ctx.require_org())}

    @router.post("")
    def create_item(payload: Schema, ctx: RequestContext = Depends(get_ctx)):  # type: ignore[valid-type]
        ctx.require(permission)
        return get_store().create(collection, stamp_new(ctx.require_org(), payload.model_dump()))

    return router
