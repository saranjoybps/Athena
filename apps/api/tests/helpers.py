"""Shared test helpers."""

from fastapi.testclient import TestClient

from app.core.store import MemoryStore, set_store
from app.main import app

ONBOARD_PAYLOAD = {
    "account": {"name": "Demo Owner", "email": "owner@demo.com", "phone": "9000000001"},
    "business": {
        "businessName": "Demo Contractors",
        "ownerName": "Demo Owner",
        "phone": "9000000001",
        "email": "owner@demo.com",
    },
    "location": {"state": "Tamil Nadu", "city": "Chennai", "pinCode": "600001", "address": "T Nagar"},
    "config": {"gstRegistered": True, "gstin": "33AAAAA0000A1Z5"},
    "trades": ["painting", "plastering"],
    "team": [],
}


def headers(uid: str, org: str | None = None, extra: dict | None = None) -> dict[str, str]:
    h = {"Authorization": f"Bearer dev:{uid}"}
    if org:
        h["X-Organization-Id"] = org
    if extra:
        h.update(extra)
    return h


def fresh_client() -> tuple[TestClient, MemoryStore]:
    store = MemoryStore()
    set_store(store)
    return TestClient(app), store


def onboard(client: TestClient, uid: str = "demo-owner") -> str:
    res = client.post("/api/v1/onboarding", json=ONBOARD_PAYLOAD, headers=headers(uid))
    assert res.status_code == 200, res.text
    return res.json()["organization"]["id"]
