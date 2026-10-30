"""Measurement types, estimate snapshots, non-consecutive crew days and progress."""

from datetime import date, timedelta

from app.attendance.service import schedule_working_days
from app.engines.scope_measurements import compute_scope
from app.estimating.pricing import compute_estimate
from app.estimating.schemas import EstimateIn, EstimateItemIn


def test_painting_wall_area_matches_reference():
    out = compute_scope(
        "area",
        {
            "surface": "walls",
            "length": 12,
            "width": 10,
            "height": 10,
            "openings": [{"width": 3, "height": 7, "count": 1}],
        },
    )
    assert out["grossQuantity"] == "440"
    assert out["deductions"] == "21"
    assert out["quantity"] == "419"
    assert out["unit"] == "sqft"
    assert "2 × (12 + 10) × 10" in out["formula"]


def test_negative_net_area_is_rejected():
    import pytest
    from app.core.errors import AppError

    with pytest.raises(AppError) as caught:
        compute_scope("area", {"surface": "walls", "length": 1, "width": 1, "height": 1, "openings": [{"width": 10, "height": 10}]})
    assert caught.value.code == "negative_quantity"


def test_length_does_not_mix_units():
    import pytest
    from app.core.errors import AppError

    with pytest.raises(AppError) as caught:
        compute_scope("length", {"unit": "rft", "segments": [{"length": 25, "count": 4, "unit": "m"}]})
    assert caught.value.code == "mixed_units"
    same = compute_scope("length", {"unit": "rft", "segments": [{"length": 25, "count": 4}]})
    assert same["quantity"] == "100"


def test_time_worker_days_stay_planned():
    out = compute_scope("time", {"duration": 3, "unit": "days", "crewSize": 2})
    assert out["quantity"] == "3"
    assert out["unit"] == "days"
    assert out["workerQuantity"] == "6"
    assert out["plannedOnly"] is True


def test_fixed_scope_is_one_job():
    out = compute_scope("fixed", {"title": "Bathroom repair", "description": "Plumbing and tile repairs"})
    assert out["quantity"] == "1"
    assert out["unit"] == "job"
    assert out["description"] == "Plumbing and tile repairs"


def test_painting_estimate_categories_total_34970():
    payload = EstimateIn(
        customerId="c1",
        siteId="s1",
        title="Painting",
        items=[
            EstimateItemIn(description="Wall painting", quantity="419", unit="sqft", rate="80", category="labour", billingMethod="area"),
            EstimateItemIn(description="Painting buckets", quantity="5", unit="piece", rate="250", category="materials", billingMethod="quantity"),
            EstimateItemIn(description="Ladder rental", quantity="2", unit="day", rate="100", category="tools", billingMethod="time"),
        ],
    )
    computed, lines = compute_estimate(payload)
    assert lines[0]["amount"] == "33520.00"
    assert lines[0]["kind"] == "work"
    assert lines[1]["kind"] == "material"
    assert lines[2]["kind"] == "tool"
    assert computed["workTotal"] == "33520.00"
    assert computed["materialTotal"] == "1250.00"
    assert computed["toolTotal"] == "200.00"
    assert computed["selling"] == "34970.00"


def test_fixed_price_is_not_multiplied():
    payload = EstimateIn(
        customerId="c1",
        siteId="s1",
        title="Bathroom",
        items=[EstimateItemIn(description="Bathroom repair", quantity="5", unit="job", rate="15000", billingMethod="fixed")],
    )
    computed, lines = compute_estimate(payload)
    assert lines[0]["quantity"] == "1"
    assert lines[0]["amount"] == "15000.00"
    assert computed["selling"] == "15000.00"


def test_friday_saturday_monday_skips_sunday():
    friday = date(2026, 10, 16)
    days = [(friday + timedelta(days=offset)).isoformat() for offset in range(4)]
    working = [days[0], days[1], days[3]]
    assert schedule_working_days({"startDate": days[0], "endDate": days[3], "workingDates": working}) == set(working)
    assert days[2] not in schedule_working_days({"startDate": days[0], "endDate": days[3], "workingDates": working})
    # A range with no explicit days still includes every calendar day.
    assert days[2] in schedule_working_days({"startDate": days[0], "endDate": days[3]})
