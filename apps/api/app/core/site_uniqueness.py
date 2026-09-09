from __future__ import annotations

from app.core.errors import AppError
from app.core.repo import list_org


def assert_site_has_no(
    store,
    collection: str,
    org_id: str,
    site_id: str,
    *,
    label: str,
) -> None:
    """Block creating a second survey/measurement/estimate/project for the same site."""
    if not site_id:
        return
    existing = list_org(store, collection, org_id, extra_filters=[("siteId", "==", site_id)], limit=1)
    if existing:
        raise AppError(
            400,
            "site_already_has_record",
            f"This site already has a {label}. Only one {label} is allowed per site.",
            {"siteId": site_id, "existingId": existing[0].get("id")},
        )
