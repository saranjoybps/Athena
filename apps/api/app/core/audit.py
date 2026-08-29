from datetime import datetime, timezone
from typing import Any

from app.core.collections import AUDIT_LOGS
from app.core.context import RequestContext
from app.core.errors import AppError
from app.core.store import DocumentStore


def write_audit(
    store: DocumentStore,
    ctx: RequestContext,
    action: str,
    entity: str,
    entity_id: str,
    previous: Any = None,
    new: Any = None,
) -> dict[str, Any]:
    entry = {
        "orgId": ctx.org_id,
        "userId": ctx.user_id,
        "action": action,
        "entity": entity,
        "entityId": entity_id,
        "previous": previous,
        "new": new,
        "requestId": ctx.request_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    return store.create(AUDIT_LOGS, entry)


def forbid_audit_delete() -> None:
    raise AppError(403, "audit_immutable", "Audit records cannot be deleted.")
