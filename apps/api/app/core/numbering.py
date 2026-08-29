from datetime import datetime, timezone

from app.core.collections import NUMBER_COUNTERS, ORGANIZATIONS
from app.core.errors import AppError
from app.core.store import DocumentStore

DEFAULT_PREFIXES = {
    "project": "PROJ",
    "estimate": "EST",
    "quote": "QUO",
    "purchase_order": "PO",
    "material_request": "MR",
    "purchase": "PUR",
    "invoice": "INV",
    "payment": "PAY",
    "change_order": "CO",
    "survey": "SUR",
    "delivery": "GRN",
}


def indian_fy(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    year = dt.year
    if dt.month < 4:
        start = year - 1
    else:
        start = year
    return str(start)


def next_number(store: DocumentStore, org_id: str, kind: str, prefix_override: str | None = None) -> str:
    org = store.get(ORGANIZATIONS, org_id) or {}
    prefixes = org.get("numberPrefixes") or {}
    prefix = prefix_override or prefixes.get(kind) or DEFAULT_PREFIXES.get(kind)
    if not prefix:
        raise AppError(400, "invalid_number_kind", "Unknown document kind.", {"kind": kind})
    fy = indian_fy()
    key = f"{org_id}:{kind}:{fy}"
    seq = store.next_counter(NUMBER_COUNTERS, key)
    return f"{prefix}-{fy}-{seq:05d}"
