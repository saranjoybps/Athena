from fastapi import APIRouter, Depends

from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.store import get_store
from app.search.service import global_search

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(q: str, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SEARCH)
    return {"query": q, "items": global_search(get_store(), ctx.require_org(), q)}
