from fastapi import APIRouter, Depends

from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.store import get_store
from app.sync.service import ingest

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("")
def sync_events(events: list[dict], ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.SYNC_WRITE)
    return ingest(get_store(), ctx, events)
