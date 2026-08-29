from decimal import Decimal

from app.engines.billing import assert_billing_cap
from app.engines.costing import apply_margin, apply_markup, estimate_totals
from app.engines.formulas import evaluate
from app.engines.gst import compute_gst
from app.engines.pack_size import procurement_quantity, recommend_packs
from app.engines.payments import allocate
from app.engines.tds import compute_tds
from app.engines.units import convert


def test_sqft_to_sqm():
    m = convert(100, "sq.ft.", "sqm")
    assert float(m.value) == round(9.290304, 6)


def test_painting_net_area():
    out = evaluate(
        "painting",
        {
            "length": 20,
            "width": 15,
            "height": 10,
            "doors": 40,
            "windows": 30,
            "coats": 2,
            "ceiling": True,
            "wastage": 0.05,
        },
        {"paintCoveragePerLitre": "10", "primerCoveragePerLitre": "12", "puttyCoveragePerKg": "15"},
    )
    # walls 2*(20+15)*10 = 700; openings 70; net 630; ceiling 300; paintable (630+300)*2*1.05
    assert float(out["wallArea"]) == 700
    assert float(out["netArea"]) == 630
    assert float(out["paintableArea"]) == 1953.0


def test_plastering_volume():
    out = evaluate("plastering", {"area": 100, "thickness": 12})
    assert float(out["wetVolume"]) > 0
    assert float(out["cementBags"]) > 0


def test_markup_vs_margin():
    marked = apply_markup(100, "0.25")
    assert marked["selling"] == "125.00"
    assert marked["method"] == "markup"
    margined = apply_margin(100, "0.20")
    assert margined["selling"] == "125.00"
    assert margined["method"] == "margin"


def test_estimate_totals_not_both():
    import pytest

    with pytest.raises(ValueError):
        estimate_totals(material=10, markup_rate=0.1, margin_rate=0.1)


def test_pack_sizes():
    qty = procurement_quantity("63", "0.05")
    rec = recommend_packs(qty, ["20", "10", "4", "1"])
    purchased = float(rec["purchasedQuantity"])
    assert purchased >= float(qty)


def test_gst_intra_and_inter():
    intra = compute_gst("1000", "0.18", "TN", "TN")
    assert intra["igst"] == "0.00"
    assert intra["cgst"] == "90.00"
    inter = compute_gst("1000", "0.18", "KA", "TN")
    assert inter["igst"] == "180.00"


def test_tds():
    t = compute_tds("100000", "0.01")
    assert t["netPayable"] == "99000.00"


def test_payment_cannot_overallocate():
    import pytest

    allocate("50", "50")
    with pytest.raises(ValueError):
        allocate("51", "50")


def test_billing_cap():
    import pytest

    assert_billing_cap(80, 20, 100, 0)
    with pytest.raises(ValueError):
        assert_billing_cap(80, 30, 100, 0)
    assert_billing_cap(80, 30, 100, 0, override=True)
