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


def test_painting_job_chain_through_quote_approval():
    set_store(MemoryStore())
    client = TestClient(app)
    uid = "painter-owner"
    onboard = client.post(
        "/api/v1/onboarding",
        json={
            "account": {"name": "Selvam"},
            "business": {
                "businessName": "Selvam Painters",
                "ownerName": "Selvam",
                "phone": "9888888888",
                "email": "selvam@example.com",
            },
            "location": {
                "state": "Tamil Nadu",
                "city": "Coimbatore",
                "pinCode": "641001",
                "address": "RS Puram",
            },
            "config": {"gstRegistered": True, "gstin": "33AAAAA0000A1Z5"},
            "trades": ["painting"],
        },
        headers=headers(uid),
    )
    assert onboard.status_code == 200, onboard.text
    org = onboard.json()["organization"]["id"]
    h = headers(uid, org)

    customer = client.post(
        "/api/v1/customers",
        json={"name": "Kumar", "phone": "9123456789", "address": "Race Course"},
        headers=h,
    )
    assert customer.status_code == 200, customer.text
    customer_id = customer.json()["id"]

    site = client.post(
        "/api/v1/sites",
        json={
            "customerId": customer_id,
            "name": "Kumar Residence",
            "address": "Race Course, Coimbatore",
            "pinCode": "641018",
        },
        headers=h,
    )
    site_id = site.json()["id"]

    survey = client.post(
        "/api/v1/surveys",
        json={
            "customerId": customer_id,
            "siteId": site_id,
            "projectType": "painting",
            "scope": "Interior emulsion two coats",
            "photos": ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
        },
        headers=h,
    )
    survey_id = survey.json()["id"]

    measurement = client.post(
        "/api/v1/measurements",
        json={
            "surveyId": survey_id,
            "siteId": site_id,
            "customerId": customer_id,
            "formulaKind": "painting",
            "originalUnit": "sqft",
            "inputs": {
                "length": 20,
                "width": 15,
                "height": 10,
                "doors": 40,
                "windows": 30,
                "coats": 2,
                "ceiling": True,
                "wastage": 0.05,
            },
        },
        headers=h,
    )
    assert measurement.status_code == 200, measurement.text
    outputs = measurement.json()["outputs"]
    assert float(outputs["paintableArea"]) > 0
    mid = measurement.json()["id"]

    estimate = client.post(
        "/api/v1/estimates",
        json={
            "customerId": customer_id,
            "siteId": site_id,
            "surveyId": survey_id,
            "measurementId": mid,
            "title": "Interior painting",
            "marginRate": "0.20",
            "items": [
                {
                    "description": "Interior emulsion",
                    "quantity": outputs["paintableArea"],
                    "unit": "sqft",
                    "materialCost": "18000",
                    "labourCost": "12000",
                }
            ],
            "included": "Putty, primer, two coats",
            "excluded": "Wood polish",
            "warranty": "1 year workmanship",
            "paymentTerms": "40% advance",
        },
        headers=h,
    )
    assert estimate.status_code == 200, estimate.text
    est = estimate.json()
    assert est["version"] == 1
    assert est["computed"]["method"] == "margin"
    assert est["number"].startswith("EST-")

    quote = client.post("/api/v1/quotes", json={"estimateId": est["id"]}, headers=h)
    assert quote.status_code == 200, quote.text
    qid = quote.json()["id"]
    sent = client.post(f"/api/v1/quotes/{qid}/send", headers=h)
    assert sent.json()["status"] == "sent"
    accepted = client.post(f"/api/v1/quotes/{qid}/accept", json={"comment": "OK"}, headers=h)
    assert accepted.json()["status"] == "accepted"

    project = client.post(
        "/api/v1/projects/from-quote",
        json={"quoteId": qid, "name": "Kumar Residence Painting"},
        headers=h,
    )
    assert project.status_code == 200, project.text
    pid = project.json()["id"]
    assert project.json()["number"].startswith("PROJ-")

    invoice = client.post(
        "/api/v1/invoices",
        json={"projectId": pid, "items": [{"description": "Advance / progress", "amount": "10000"}]},
        headers=headers(uid, org, {"Idempotency-Key": "inv-1"}),
    )
    assert invoice.status_code == 200, invoice.text
    pay = client.post(
        "/api/v1/payments",
        json={"invoiceId": invoice.json()["id"], "amount": "10000", "method": "upi"},
        headers=headers(uid, org, {"Idempotency-Key": "pay-1"}),
    )
    assert pay.status_code == 200, pay.text

    profit = client.get(f"/api/v1/reports/project-profitability/{pid}", headers=h)
    assert profit.status_code == 200
    assert "actualProfit" in profit.json()
