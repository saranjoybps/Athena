from copy import deepcopy
from typing import Any

PAINTING_TEMPLATE: dict[str, Any] = {
    "trade": "painting",
    "source": "template",
    "workItems": [
        {"code": "prep", "name": "Surface Preparation"},
        {"code": "putty", "name": "Putty"},
        {"code": "primer", "name": "Primer"},
        {"code": "coat1", "name": "First Coat"},
        {"code": "coat2", "name": "Second Coat"},
        {"code": "touchup", "name": "Touch-up"},
    ],
    "materials": [
        {"name": "Interior emulsion", "unit": "l", "category": "paint", "coverage": 10, "gstRate": 0.18, "hsn": "3209"},
        {"name": "Primer", "unit": "l", "category": "paint", "coverage": 12, "gstRate": 0.18, "hsn": "3208"},
        {"name": "Putty", "unit": "kg", "category": "paint", "coverage": 15, "gstRate": 0.18, "hsn": "3214"},
        {"name": "Masking tape", "unit": "rolls", "category": "consumable", "gstRate": 0.18},
    ],
    "labourCategories": [
        {"name": "Painter", "dailyRate": 900, "hourlyRate": 150},
        {"name": "Helper", "dailyRate": 650, "hourlyRate": 90},
    ],
    "formula": {
        "kind": "painting",
        "config": {
            "wastage": "0.05",
            "paintCoveragePerLitre": "10",
            "primerCoveragePerLitre": "12",
            "puttyCoveragePerKg": "15",
        },
    },
    "quoteTemplate": {
        "validityDays": 15,
        "paymentTerms": "40% advance, 40% on progress, 20% on completion",
        "warranty": "1 year on workmanship",
    },
}

TRADE_LIBRARY: dict[str, dict[str, Any]] = {
    "painting": PAINTING_TEMPLATE,
    "plastering": {
        "trade": "plastering",
        "source": "template",
        "workItems": [{"code": "plaster", "name": "Cement plaster"}],
        "materials": [
            {"name": "Cement", "unit": "bags", "category": "cement", "gstRate": 0.28, "hsn": "2523"},
            {"name": "Sand", "unit": "cft", "category": "aggregate", "gstRate": 0.05},
        ],
        "labourCategories": [{"name": "Mason", "dailyRate": 1100}, {"name": "Helper", "dailyRate": 700}],
        "formula": {"kind": "plastering", "config": {"wastage": "0.20", "cementParts": 1, "sandParts": 4}},
    },
    "masonry": {
        "trade": "masonry",
        "source": "template",
        "workItems": [{"code": "brickwork", "name": "Brick masonry"}],
        "materials": [
            {"name": "Bricks", "unit": "pcs", "category": "masonry"},
            {"name": "Cement", "unit": "bags", "category": "cement"},
            {"name": "Sand", "unit": "cft", "category": "aggregate"},
        ],
        "labourCategories": [{"name": "Mason", "dailyRate": 1100}, {"name": "Helper", "dailyRate": 700}],
        "formula": {"kind": "masonry", "config": {}},
    },
    "flooring": {
        "trade": "flooring",
        "source": "template",
        "workItems": [{"code": "tile", "name": "Floor tiling"}],
        "materials": [
            {"name": "Tiles", "unit": "boxes", "category": "flooring"},
            {"name": "Adhesive", "unit": "kg", "category": "flooring"},
            {"name": "Grout", "unit": "kg", "category": "flooring"},
        ],
        "labourCategories": [{"name": "Tile mason", "dailyRate": 1200}],
        "formula": {"kind": "flooring", "config": {"wastage": "0.08"}},
    },
    "waterproofing": {
        "trade": "waterproofing",
        "source": "template",
        "workItems": [{"code": "wp", "name": "Waterproofing coats"}],
        "materials": [{"name": "Waterproofing chemical", "unit": "l", "category": "chemical"}],
        "labourCategories": [{"name": "Applicator", "dailyRate": 1000}],
        "formula": {"kind": "waterproofing", "config": {"coveragePerLitre": 5}},
    },
    "electrical": {
        "trade": "electrical",
        "source": "template",
        "workItems": [{"code": "wiring", "name": "Point wiring"}],
        "materials": [{"name": "Wire 1.5 sq.mm", "unit": "m", "category": "electrical"}],
        "labourCategories": [{"name": "Electrician", "dailyRate": 1200}],
        "formula": {"kind": "painting", "config": {}},
    },
    "plumbing": {
        "trade": "plumbing",
        "source": "template",
        "workItems": [{"code": "pipe", "name": "Pipe work"}],
        "materials": [{"name": "PVC pipe", "unit": "m", "category": "plumbing"}],
        "labourCategories": [{"name": "Plumber", "dailyRate": 1100}],
        "formula": {"kind": "painting", "config": {}},
    },
    "handyman": {
        "trade": "handyman",
        "source": "template",
        "workItems": [{"code": "job", "name": "General repair"}],
        "materials": [],
        "labourCategories": [{"name": "Technician", "hourlyRate": 200}],
        "formula": {"kind": "painting", "config": {}},
    },
}


def templates_for_trades(trades: list[str]) -> list[dict[str, Any]]:
    out = []
    for t in trades:
        key = t.strip().lower().replace(" ", "_")
        if key in TRADE_LIBRARY:
            out.append(deepcopy(TRADE_LIBRARY[key]))
    return out
