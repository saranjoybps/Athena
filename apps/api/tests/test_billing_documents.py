from fastapi.testclient import TestClient

from app.core.store import MemoryStore, set_store
from app.main import app


def headers(uid: str, org: str | None = None, extra: dict | None = None):
    h = {"Authorization": f"Bearer dev:{uid}"}
    if org:
        h["X-Organization-Id"] = org
    if extra:
        h.update(extra)
    return h


def _setup_quote(client: TestClient, uid: str = "doc-owner"):
    set_store(MemoryStore())
    onboard = client.post(
        "/api/v1/onboarding",
        json={
            "account": {"name": "Owner"},
            "business": {"businessName": "Doc Co", "ownerName": "Owner", "phone": "9000000000", "email": "o@example.com"},
            "location": {"state": "Tamil Nadu", "city": "Chennai", "pinCode": "600001", "address": "Main St"},
            "config": {"gstRegistered": True, "gstin": "33AAAAA0000A1Z5", "pan": "AAAAA0000A"},
            "trades": ["painting"],
        },
        headers=headers(uid),
    )
    org = onboard.json()["organization"]["id"]
    h = headers(uid, org)
    customer = client.post("/api/v1/customers", json={"name": "Buyer", "phone": "9111111111", "gstin": "33BBBBB0000B1Z5"}, headers=h)
    customer_id = customer.json()["id"]
    site = client.post("/api/v1/sites", json={"customerId": customer_id, "name": "Site A", "address": "Site addr"}, headers=h)
    estimate = client.post(
        "/api/v1/estimates",
        json={
            "customerId": customer_id,
            "siteId": site.json()["id"],
            "title": "Paint job",
            "items": [{"description": "Emulsion", "quantity": "100", "unit": "sqft", "materialCost": "5000", "labourCost": "3000"}],
            "marginRate": "0.20",
        },
        headers=h,
    )
    quote = client.post("/api/v1/quotes", json={"estimateId": estimate.json()["id"]}, headers=h)
    qid = quote.json()["id"]
    client.post(f"/api/v1/quotes/{qid}/send", headers=h)
    client.post(f"/api/v1/quotes/{qid}/accept", json={"comment": "ok"}, headers=h)
    return h, qid


def test_get_quote_enriched_with_line_items():
    client = TestClient(app)
    h, qid = _setup_quote(client)
    res = client.get(f"/api/v1/quotes/{qid}", headers=h)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["customer"]["name"] == "Buyer"
    assert body["branding"]["company_name"] == "Doc Co"
    assert len(body["line_items"]) == 1
    assert body["line_items"][0]["description"] == "Emulsion"
    assert float(body["total_amount"]) > 0


def test_invoice_from_quote_and_pdf_fields():
    client = TestClient(app)
    h, qid = _setup_quote(client)
    inv = client.post(
        f"/api/v1/invoices/from-quote/{qid}",
        json={"kind": "final"},
        headers={**h, "Idempotency-Key": "from-q-1"},
    )
    assert inv.status_code == 200, inv.text
    inv_id = inv.json()["id"]
    assert inv.json()["line_items"]
    assert inv.json()["customer"]["name"] == "Buyer"

    detail = client.get(f"/api/v1/invoices/{inv_id}", headers=h)
    assert detail.status_code == 200
    assert detail.json()["number"].startswith("INV-")

    sent = client.post(f"/api/v1/invoices/{inv_id}/send", headers=h)
    assert sent.status_code == 200
    assert sent.json()["status"] == "sent"

    dup = client.post(
        f"/api/v1/invoices/from-quote/{qid}",
        json={},
        headers={**h, "Idempotency-Key": "from-q-2"},
    )
    assert dup.status_code == 200
    assert dup.json()["id"] == inv_id


def test_document_branding_update():
    client = TestClient(app)
    h, _ = _setup_quote(client)
    res = client.patch(
        "/api/v1/organizations/current/document-branding",
        json={"bankName": "HDFC", "upiId": "doc@upi", "termsConditions": "Payment within 7 days"},
        headers=h,
    )
    assert res.status_code == 200, res.text
    assert res.json()["bank_name"] == "HDFC"
    assert res.json()["upi_id"] == "doc@upi"

    get_res = client.get("/api/v1/organizations/current/document-branding", headers=h)
    assert get_res.json()["terms_conditions"] == "Payment within 7 days"
