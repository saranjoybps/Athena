import pytest
from fastapi.testclient import TestClient

from app.core.store import MemoryStore, set_store
from app.main import app


@pytest.fixture()
def store():
    mem = MemoryStore()
    set_store(mem)
    return mem


@pytest.fixture()
def client(store):
    return TestClient(app)


def headers(uid: str, org: str | None = None, extra: dict | None = None):
    h = {"Authorization": f"Bearer dev:{uid}"}
    if org:
        h["X-Organization-Id"] = org
    if extra:
        h.update(extra)
    return h


ONBOARD = {
    "account": {"name": "Ravi"},
    "business": {
        "businessName": "Ravi Painting",
        "ownerName": "Ravi",
        "phone": "9876543210",
        "email": "ravi@example.com",
    },
    "location": {
        "state": "Tamil Nadu",
        "city": "Chennai",
        "pinCode": "600001",
        "address": "Anna Nagar",
    },
    "config": {},
    "trades": ["painting"],
    "team": [],
}


def onboard(client: TestClient, uid: str) -> str:
    res = client.post("/api/v1/onboarding", json=ONBOARD, headers=headers(uid))
    assert res.status_code == 200, res.text
    return res.json()["organization"]["id"]


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_tenant_isolation(client):
    org_a = onboard(client, "user-a")
    org_b = onboard(client, "user-b")
    created = client.post(
        "/api/v1/customers",
        json={"name": "Kumar", "phone": "9000000000"},
        headers=headers("user-a", org_a),
    )
    assert created.status_code == 200
    cid = created.json()["id"]
    leaked = client.get(f"/api/v1/customers/{cid}", headers=headers("user-b", org_b))
    assert leaked.status_code == 404
    forbidden_org = client.get("/api/v1/customers", headers=headers("user-b", org_a))
    assert forbidden_org.status_code == 403


def test_customer_cannot_view_profit(client, store):
    org = onboard(client, "owner-1")
    store.create(
        "memberships",
        {"orgId": org, "userId": "cust-1", "roles": ["customer"], "status": "active"},
    )
    res = client.get(
        "/api/v1/reports/project-profitability/none",
        headers=headers("cust-1", org),
    )
    assert res.status_code == 403


def test_worker_cannot_invoice(client, store):
    org = onboard(client, "owner-2")
    store.create(
        "memberships",
        {"orgId": org, "userId": "worker-1", "roles": ["worker"], "status": "active"},
    )
    res = client.post(
        "/api/v1/invoices",
        json={"projectId": "x", "items": [{"amount": "10"}]},
        headers=headers("worker-1", org, {"Idempotency-Key": "k1"}),
    )
    assert res.status_code == 403
