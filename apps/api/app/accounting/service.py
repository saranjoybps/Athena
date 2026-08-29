from __future__ import annotations

from typing import Any

from app.core.collections import ACCOUNTING_ENTRIES
from app.core.repo import now_iso, stamp_new
from app.core.store import DocumentStore


def post_entry(
    store: DocumentStore,
    org_id: str,
    entry_type: str,
    amount: str,
    *,
    project_id: str | None = None,
    reference: str | None = None,
    reference_id: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    return store.create(
        ACCOUNTING_ENTRIES,
        stamp_new(
            org_id,
            {
                "type": entry_type,
                "amount": amount,
                "projectId": project_id,
                "reference": reference,
                "referenceId": reference_id,
                "notes": notes,
                "postedAt": now_iso(),
            },
        ),
    )
