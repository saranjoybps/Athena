from __future__ import annotations

from decimal import Decimal
from typing import Any, Callable

from app.engines.units import D, qty

FormulaFn = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]


def _num(inputs: dict[str, Any], key: str, default: str | int | float = 0) -> Decimal:
    return D(inputs.get(key, default) or 0)


def painting(inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or {}
    length = _num(inputs, "length")
    width = _num(inputs, "width")
    height = _num(inputs, "height")
    doors = _num(inputs, "doors")
    windows = _num(inputs, "windows")
    coats = _num(inputs, "coats", 2)
    include_ceiling = bool(inputs.get("ceiling", True))
    wastage = _num(inputs, "wastage", cfg.get("wastage", "0.05"))
    paint_coverage = D(cfg.get("paintCoveragePerLitre", "10"))  # sq.ft per litre default? use sq.unit of inputs
    primer_coverage = D(cfg.get("primerCoveragePerLitre", "12"))
    putty_coverage = D(cfg.get("puttyCoveragePerKg", "15"))

    wall_area = (length + width) * 2 * height
    ceiling_area = length * width if include_ceiling else Decimal("0")
    openings = doors + windows
    net_area = wall_area - openings
    if net_area < 0:
        net_area = Decimal("0")
    paintable = (net_area + ceiling_area) * coats * (Decimal("1") + wastage)
    primer = qty(net_area / primer_coverage) if primer_coverage else Decimal("0")
    putty = qty(net_area / putty_coverage) if putty_coverage else Decimal("0")
    paint = qty(paintable / paint_coverage) if paint_coverage else Decimal("0")
    return {
        "wallArea": qty(wall_area),
        "ceilingArea": qty(ceiling_area),
        "openingDeductions": qty(openings),
        "netArea": qty(net_area),
        "paintableArea": qty(paintable),
        "primer": primer,
        "putty": putty,
        "paint": paint,
        "consumables": qty(paint * D(cfg.get("consumableFactor", "0.02"))),
        "unit": inputs.get("areaUnit", "sqft"),
    }


def plastering(inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or {}
    area = _num(inputs, "area")
    thickness_mm = _num(inputs, "thickness", 12)
    ratio_c = D(cfg.get("cementParts", inputs.get("cementParts", 1)))
    ratio_s = D(cfg.get("sandParts", inputs.get("sandParts", 4)))
    wastage = _num(inputs, "wastage", cfg.get("wastage", "0.20"))
    wet = area * (thickness_mm / Decimal("1000"))
    dry = wet * Decimal("1.33") * (Decimal("1") + wastage)
    parts = ratio_c + ratio_s
    cement_cum = dry * ratio_c / parts
    sand_cum = dry * ratio_s / parts
    bags = cement_cum / D(cfg.get("cementBagCum", "0.035"))
    sand_cft = sand_cum / D("0.028316846592")
    return {
        "wetVolume": qty(wet),
        "dryVolume": qty(dry),
        "cementBags": qty(bags),
        "sandCft": qty(sand_cft),
        "wastage": qty(wastage),
    }


def masonry(inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or {}
    length = _num(inputs, "length")
    height = _num(inputs, "height")
    thickness = _num(inputs, "thickness", 0.23)
    wastage = _num(inputs, "wastage", cfg.get("wastage", "0.05"))
    brick_vol = D(cfg.get("brickVolume", "0.002"))  # m3
    wall_vol = length * height * thickness
    bricks = (wall_vol / brick_vol) * (Decimal("1") + wastage)
    mortar = wall_vol * D(cfg.get("mortarFraction", "0.25"))
    cement_bags = mortar * D(cfg.get("cementBagsPerCumMortar", "6.5"))
    sand_cft = mortar * D(cfg.get("sandCftPerCumMortar", "35"))
    return {
        "wallVolume": qty(wall_vol),
        "brickQuantity": qty(bricks),
        "mortar": qty(mortar),
        "cement": qty(cement_bags),
        "sand": qty(sand_cft),
    }


def flooring(inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or {}
    area = _num(inputs, "area")
    wastage = _num(inputs, "wastage", cfg.get("wastage", "0.08"))
    tile_area = D(cfg.get("tileArea", inputs.get("tileArea", "2.25")))  # sq.ft per tile default 12x12? use 1.5x1.5=2.25
    box_size = D(cfg.get("boxSize", inputs.get("boxSize", 10)))
    required = area * (Decimal("1") + wastage)
    tiles = required / tile_area if tile_area else Decimal("0")
    boxes = (tiles / box_size).to_integral_value() if box_size else tiles
    if box_size and tiles / box_size > boxes:
        boxes += 1
    adhesive = required * D(cfg.get("adhesivePerArea", "0.05"))
    grout = required * D(cfg.get("groutPerArea", "0.01"))
    return {
        "area": qty(area),
        "tileQuantity": qty(tiles),
        "boxes": qty(boxes),
        "adhesive": qty(adhesive),
        "grout": qty(grout),
        "wastage": qty(wastage),
    }


def concrete(inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or {}
    length = _num(inputs, "length")
    width = _num(inputs, "width")
    depth = _num(inputs, "depth")
    c = D(cfg.get("cementParts", inputs.get("cementParts", 1)))
    s = D(cfg.get("sandParts", inputs.get("sandParts", 2)))
    a = D(cfg.get("aggParts", inputs.get("aggParts", 4)))
    vol = length * width * depth
    dry = vol * Decimal("1.54")
    parts = c + s + a
    cement = (dry * c / parts) / D(cfg.get("cementBagCum", "0.035"))
    sand = dry * s / parts
    agg = dry * a / parts
    return {
        "volume": qty(vol),
        "cement": qty(cement),
        "sand": qty(sand),
        "aggregate": qty(agg),
        "mixRatio": f"{c}:{s}:{a}",
    }


def waterproofing(inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or {}
    area = _num(inputs, "area")
    coats = _num(inputs, "coats", 2)
    coverage = D(cfg.get("coveragePerLitre", inputs.get("coverage", 5)))
    labour_rate = D(cfg.get("labourPerArea", 0))
    chemical = (area * coats) / coverage if coverage else Decimal("0")
    return {
        "area": qty(area),
        "coats": qty(coats),
        "coverage": qty(coverage),
        "chemicalQuantity": qty(chemical),
        "labour": qty(area * labour_rate),
    }


BUILTIN: dict[str, FormulaFn] = {
    "painting": painting,
    "plastering": plastering,
    "masonry": masonry,
    "flooring": flooring,
    "concrete": concrete,
    "waterproofing": waterproofing,
}


def evaluate(kind: str, inputs: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    fn = BUILTIN.get(kind)
    if not fn:
        raise ValueError(f"Unknown formula {kind}")
    result = fn(inputs, config)
    serializable = {}
    for k, v in result.items():
        serializable[k] = str(v) if isinstance(v, Decimal) else v
    return serializable
