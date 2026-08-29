from __future__ import annotations

from typing import Any, Callable

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel

from app.core.audit import write_audit
from app.core.context import RequestContext, get_ctx
from app.core.repo import list_org, org_owned, soft_delete, stamp_new, update_doc
from app.core.store import DocumentStore, get_store


def make_crud_router(
    prefix: str,
    collection: str,
    tag: str,
    schema: type[BaseModel],
    read_perm: str,
    write_perm: str,
    *,
    on_create: Callable[[DocumentStore, RequestContext, dict[str, Any]], dict[str, Any]] | None = None,
    on_update: Callable[[DocumentStore, RequestContext, str, dict[str, Any]], dict[str, Any]] | None = None,
    redact: Callable[[dict[str, Any], RequestContext], dict[str, Any]] | None = None,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    def _redact(doc: dict[str, Any], ctx: RequestContext) -> dict[str, Any]:
        return redact(doc, ctx) if redact else doc

    @router.get("")
    def list_items(ctx: RequestContext = Depends(get_ctx)):
        ctx.require(read_perm)
        items = list_org(get_store(), collection, ctx.require_org())
        return {"items": [_redact(i, ctx) for i in items]}

    @router.post("")
    def create_item(body: dict = Body(...), ctx: RequestContext = Depends(get_ctx)):
        ctx.require(write_perm)
        payload = schema.model_validate(body)
        store = get_store()
        org_id = ctx.require_org()
        data = stamp_new(org_id, payload.model_dump())
        if on_create:
            doc = on_create(store, ctx, data)
        else:
            doc = store.create(collection, data)
        write_audit(store, ctx, f"{tag}.create", tag, doc["id"], new=doc)
        return _redact(doc, ctx)

    @router.get("/{doc_id}")
    def get_item(doc_id: str, ctx: RequestContext = Depends(get_ctx)):
        ctx.require(read_perm)
        doc = org_owned(get_store(), collection, doc_id, ctx.require_org())
        return _redact(doc, ctx)

    @router.patch("/{doc_id}")
    def patch_item(doc_id: str, body: dict = Body(...), ctx: RequestContext = Depends(get_ctx)):
        ctx.require(write_perm)
        payload = schema.model_validate(body)
        store = get_store()
        org_id = ctx.require_org()
        fields = payload.model_dump(exclude_unset=True)
        if on_update:
            doc = on_update(store, ctx, doc_id, fields)
        else:
            doc = update_doc(store, collection, doc_id, org_id, fields)
        write_audit(store, ctx, f"{tag}.update", tag, doc_id, new=doc)
        return _redact(doc, ctx)

    @router.delete("/{doc_id}")
    def delete_item(doc_id: str, ctx: RequestContext = Depends(get_ctx)):
        ctx.require(write_perm)
        store = get_store()
        doc = soft_delete(store, collection, doc_id, ctx.require_org())
        write_audit(store, ctx, f"{tag}.delete", tag, doc_id, new=doc)
        return {"ok": True, "id": doc_id}

    return router
