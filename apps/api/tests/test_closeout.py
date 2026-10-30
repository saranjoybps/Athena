from decimal import Decimal

from app.billing.closeout import financial_summary, guard_duplicate_lines, suggest_billable_lines
from app.core.errors import AppError
from app.engines.units import D


def _line():
    return {
        "id": "L1",
        "kind": "work",
        "billingMethod": "area",
        "description": "Wall painting",
        "quantity": "419",
        "unit": "sqft",
        "rate": "80",
        "amount": "33520.00",
    }


def test_labour_billed_on_completed_area_not_the_full_forecast():
    lines = suggest_billable_lines([_line()], {"L1": D(400)}, {}, [], set(), [], set())
    assert lines[0]["quantity"] == "400"
    assert lines[0]["amount"] == "32000.00"


def test_fixed_price_does_not_rise_when_cost_rises():
    fixed = {"id": "F1", "kind": "work", "billingMethod": "fixed", "description": "Bathroom", "quantity": "1", "unit": "job", "rate": "15000", "amount": "15000.00"}
    lines = suggest_billable_lines([fixed], {"F1": D(1)}, {}, [{"id": "e1", "amount": "9000", "category": "material", "billableToCustomer": False}], set(), [], set())
    assert lines[0]["amount"] == "15000.00"
    assert all("expenseId" not in line for line in lines)


def test_billable_material_and_tool_are_separate_from_estimate():
    lines = suggest_billable_lines(
        [_line()],
        {"L1": D(400)},
        {},
        [
            {"id": "m1", "amount": "1500", "category": "material", "description": "Paint", "billableToCustomer": True},
            {"id": "t1", "amount": "300", "category": "tool", "description": "Ladder", "billableToCustomer": True},
            {"id": "m2", "amount": "400", "category": "material", "description": "Wastage", "billableToCustomer": False},
        ],
        set(),
        [],
        set(),
    )
    amounts = {line["description"]: line["amount"] for line in lines}
    assert amounts["Wall painting"] == "32000.00"
    assert amounts["Paint"] == "1500.00"
    assert amounts["Ladder"] == "300.00"
    assert "Wastage" not in amounts


def test_already_invoiced_quantity_is_not_billed_again():
    lines = suggest_billable_lines([_line()], {"L1": D(419)}, {"L1": D(400)}, [], set(), [], set())
    assert lines[0]["quantity"] == "19"
    assert lines[0]["amount"] == "1520.00"
    none = suggest_billable_lines([_line()], {"L1": D(400)}, {"L1": D(400)}, [], set(), [], set())
    assert none == []


def test_duplicate_invoice_is_rejected():
    import pytest

    invoices = [{"status": "sent", "items": [{"sourceLineId": "L1", "quantity": "400"}]}]
    with pytest.raises(AppError) as caught:
        guard_duplicate_lines([{"sourceLineId": "L1", "quantity": "30"}], invoices, {"L1": Decimal("419")})
    assert caught.value.code == "already_billed"


def test_margin_is_not_called_project_profit():
    summary = financial_summary(
        original_estimate=D("34970"),
        agreed_value=D("34970"),
        variations_total=D(0),
        labour_revenue=D("32000"),
        wages=D("5700"),
        material_cost=D("1500"),
        tool_cost=D("300"),
        other_cost=D(0),
        invoiced=D("33900"),
        collected=D("33900"),
    )
    assert summary["labourMargin"] == "26300.00"
    assert summary["accountingProfit"] == "26400.00"
    assert summary["cashResult"] == "26400.00"
    assert "not accounting profit" in summary["cashBasis"]
    assert summary["labourMargin"] != summary["accountingProfit"] or summary["actualMaterialCost"] == "1500.00"


def test_variation_is_added_once():
    first = suggest_billable_lines([], {}, {}, [], set(), [{"id": "co1", "status": "approved", "sellingPrice": "2000", "reason": "Extra wall"}], set())
    assert first[0]["amount"] == "2000.00"
    second = suggest_billable_lines([], {}, {}, [], set(), [{"id": "co1", "status": "approved", "sellingPrice": "2000"}], {"co1"})
    assert second == []
