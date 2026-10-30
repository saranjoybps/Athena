from app.billing.invoice_calc import build_customer_invoice


ESTIMATE = [
    {"id": "L1", "kind": "work", "billingMethod": "area", "description": "Painting labour", "quantity": "407", "unit": "sqft", "rate": "80", "amount": "32560.00"},
    {"id": "M1", "kind": "material", "description": "Paint estimate", "quantity": "1", "unit": "lot", "rate": "1250", "amount": "1250.00"},
    {"id": "T1", "kind": "tool", "description": "Ladder estimate", "quantity": "1", "unit": "lot", "rate": "200", "amount": "200.00"},
]
EXPENSES = [
    {"id": "w1", "category": "labour", "description": "Worker wages", "amount": "1900", "billableToCustomer": False},
    {"id": "m1", "category": "material", "description": "Paint used", "amount": "1500", "billableToCustomer": True},
    {"id": "t1", "category": "tool", "description": "Ladder hire", "amount": "300", "billableToCustomer": True},
]


def test_actual_work_replaces_estimate_and_wages_stay_off_the_invoice():
    bill = build_customer_invoice(ESTIMATE, labour_mode="actual", completed={"L1": "407"}, billable_expenses=[row for row in EXPENSES if row["billableToCustomer"]])
    assert bill["labour"] == "32560.00"
    assert bill["materials"] == "1500.00"
    assert bill["tools"] == "300.00"
    assert bill["subtotal"] == "34360.00"
    assert bill["wagesIncluded"] == "0.00"
    assert all("1900" not in line["amount"] for line in bill["lines"])
    assert all(line["description"] != "Worker wages" for line in bill["lines"])


def test_350_sqft_recalculated_labour_is_28000_not_added_to_the_estimate():
    bill = build_customer_invoice(ESTIMATE, labour_mode="actual", completed={"L1": "350"}, billable_expenses=[])
    assert bill["labour"] == "28000.00"
    assert bill["materials"] == "1250.00"
    assert bill["subtotal"] == "29450.00"


def test_keep_estimated_labour_still_replaces_materials_and_tools_when_billable():
    bill = build_customer_invoice(
        ESTIMATE,
        labour_mode="estimate",
        completed={"L1": "350"},
        billable_expenses=[row for row in EXPENSES if row["billableToCustomer"]],
    )
    assert bill["labour"] == "32560.00"
    assert bill["materials"] == "1500.00"
    assert bill["tools"] == "300.00"
    assert bill["subtotal"] == "34360.00"


def test_estimate_snapshot_amounts_are_not_mutated():
    original = [dict(line) for line in ESTIMATE]
    build_customer_invoice(ESTIMATE, labour_mode="actual", completed={"L1": "350"}, billable_expenses=EXPENSES)
    assert ESTIMATE == original
