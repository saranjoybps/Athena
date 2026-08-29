from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.collections import MEMBERSHIPS, USERS
from app.core.context import RequestContext, get_ctx
from app.core.permissions import Permission
from app.core.repo import list_org, now_iso
from app.core.store import get_store

router = APIRouter(prefix="/users", tags=["users"])


class InviteIn(BaseModel):
    email: str
    role: str
    name: str | None = None


@router.get("")
def list_users(ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.USER_MANAGE)
    return {"items": list_org(get_store(), MEMBERSHIPS, ctx.require_org())}


@router.post("/invite")
def invite(payload: InviteIn, ctx: RequestContext = Depends(get_ctx)):
    ctx.require(Permission.USER_MANAGE)
    store = get_store()
    org_id = ctx.require_org()
    return store.create(
        MEMBERSHIPS,
        {
            "orgId": org_id,
            "email": payload.email,
            "roles": [payload.role],
            "status": "invited",
            "name": payload.name,
            "createdAt": now_iso(),
        },
    )
