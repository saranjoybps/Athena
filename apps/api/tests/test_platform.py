from datetime import datetime, timezone

import pytest

from app.core.numbering import indian_fy, next_number
from app.core.store import MemoryStore
from app.core.entitlements import check_limit, entitlements_for
from app.core.errors import AppError


def test_fy_and_numbering():
    store = MemoryStore()
    store.set(
        "organizations",
        "org1",
        {"id": "org1", "numberPrefixes": {"invoice": "INV"}},
    )
    n1 = next_number(store, "org1", "invoice")
    n2 = next_number(store, "org1", "invoice")
    fy = indian_fy()
    assert n1 == f"INV-{fy}-00001"
    assert n2 == f"INV-{fy}-00002"


def test_entitlement_cap():
    store = MemoryStore()
    store.set("organizations", "org1", {"id": "org1", "plan": "starter"})
    ents = entitlements_for({"plan": "starter"})
    assert ents["maxUsers"] == 3
    with pytest.raises(AppError):
        check_limit(store, "org1", "users", 3)
