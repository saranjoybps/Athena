/**
 * Estimate (BOQ) lines as edited on the phone. Every line is quantity × rate for the customer;
 * cost fields are internal only. The server re-prices every line with the same rules
 * (`apps/api/app/estimating/pricing.py`), so the totals shown here match the PDF and the quote.
 */
import type { SelectOption } from "@/components/ui/SelectDropdown";

export type LineKind = "work" | "material" | "tool";

export type EstimateLine = {
  key: string;
  kind: LineKind;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  labourCost: string;
  materialCost: string;
  equipmentCost: string;
  otherCost: string;
  /** Material: catalog link and purchase price per unit (material cost = qty × purchase). */
  catalogMaterialId: string;
  unitPurchase: string;
  /** Tool: quantity = units × days, rate is per unit per day. */
  toolId: string;
  toolUnits: string;
  days: string;
  measurementId: string;
  measurementItemId: string;
};

export const WORK_UNITS: SelectOption[] = [
  { id: "sqft", label: "sqft" },
  { id: "rft", label: "rft (running feet)" },
  { id: "nos", label: "nos" },
  { id: "sqm", label: "sqm" },
  { id: "rmt", label: "rmt (running metre)" },
  { id: "cft", label: "cft" },
  { id: "ls", label: "Lump sum" },
];

export const MATERIAL_UNITS: SelectOption[] = [
  { id: "ltr", label: "litre" },
  { id: "kg", label: "kg" },
  { id: "bag", label: "bag" },
  { id: "pcs", label: "pcs" },
  { id: "box", label: "box" },
  { id: "nos", label: "nos" },
  { id: "sqft", label: "sqft" },
  { id: "rft", label: "rft" },
];

export const GST_OPTIONS: SelectOption[] = [
  { id: "0", label: "No GST" },
  { id: "5", label: "GST 5%" },
  { id: "12", label: "GST 12%" },
  { id: "18", label: "GST 18%" },
  { id: "28", label: "GST 28%" },
];

export const KIND_LABEL: Record<LineKind, string> = { work: "Work", material: "Material", tool: "Tool charge" };

/** Unit dropdown options that always include the line's current unit. */
export function unitOptions(kind: LineKind, current: string): SelectOption[] {
  const base = kind === "material" ? MATERIAL_UNITS : WORK_UNITS;
  if (!current || base.some((o) => o.id === current)) return base;
  return [{ id: current, label: current }, ...base];
}

export function lineKey() {
  return `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newLine(kind: LineKind, patch: Partial<EstimateLine> = {}): EstimateLine {
  return {
    key: lineKey(),
    kind,
    description: "",
    quantity: "",
    unit: kind === "material" ? "ltr" : kind === "tool" ? "day" : "sqft",
    rate: "",
    labourCost: "",
    materialCost: "",
    equipmentCost: "",
    otherCost: "",
    catalogMaterialId: "",
    unitPurchase: "",
    toolId: "",
    toolUnits: kind === "tool" ? "1" : "",
    days: kind === "tool" ? "1" : "",
    measurementId: "",
    measurementItemId: "",
    ...patch,
  };
}

function num(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineQuantity(line: EstimateLine) {
  if (line.kind === "tool") return num(line.toolUnits) * num(line.days);
  return num(line.quantity);
}

export function lineAmount(line: EstimateLine) {
  return round2(lineQuantity(line) * round2(num(line.rate)));
}

/** Internal cost of a line. Material lines cost qty × purchase price when it is known. */
export function lineCost(line: EstimateLine) {
  const material = line.kind === "material" && line.unitPurchase ? round2(lineQuantity(line) * num(line.unitPurchase)) : num(line.materialCost);
  return round2(material + num(line.labourCost) + num(line.equipmentCost) + num(line.otherCost));
}

export type LineErrors = Partial<Record<"description" | "quantity" | "rate" | "toolUnits" | "days", string>>;

export function lineErrors(line: EstimateLine): LineErrors {
  const e: LineErrors = {};
  if (!line.description.trim()) e.description = line.kind === "material" ? "Pick or name the material" : line.kind === "tool" ? "Pick or name the tool" : "Describe the work";
  if (line.kind === "tool") {
    if (!(num(line.toolUnits) > 0)) e.toolUnits = "Units?";
    if (!(num(line.days) > 0)) e.days = "Days?";
  } else if (!(num(line.quantity) > 0)) {
    e.quantity = "Enter quantity";
  }
  if (!line.rate.trim()) e.rate = "Enter rate";
  else if (num(line.rate) < 0 || !Number.isFinite(Number(line.rate))) e.rate = "Invalid rate";
  return e;
}

export function estimateTotals(lines: EstimateLine[], discountRaw: string, gstPercent: string) {
  const by = { work: 0, material: 0, tool: 0 } as Record<LineKind, number>;
  let cost = 0;
  for (const l of lines) {
    by[l.kind] = round2(by[l.kind] + lineAmount(l));
    cost = round2(cost + lineCost(l));
  }
  const gross = round2(by.work + by.material + by.tool);
  const discount = Math.min(Math.max(round2(num(discountRaw)), 0), gross);
  const taxable = round2(gross - discount);
  const rate = num(gstPercent) / 100;
  const gst = round2(taxable * rate);
  return { ...by, gross, discount, taxable, gst, grand: round2(taxable + gst), cost, profit: round2(taxable - cost) };
}

export function lineFromApi(item: Record<string, unknown>): EstimateLine {
  const kind = (["work", "material", "tool"].includes(String(item.kind)) ? String(item.kind) : "work") as LineKind;
  const qty = num(item.quantity);
  const materialCost = num(item.materialCost);
  const rate = item.rate != null && item.rate !== "" ? String(item.rate) : item.unitPrice != null ? String(item.unitPrice) : "";
  const str = (v: unknown) => (v == null || v === "" || v === "0" || v === "0.00" ? "" : String(v));
  return newLine(kind, {
    description: String(item.description || ""),
    quantity: item.quantity != null ? String(item.quantity) : "",
    unit: String(item.unit || (kind === "tool" ? "day" : "sqft")),
    rate,
    labourCost: str(item.labourCost),
    materialCost: str(item.materialCost),
    equipmentCost: str(item.equipmentCost),
    otherCost: str(item.otherCost),
    catalogMaterialId: String(item.catalogMaterialId || ""),
    unitPurchase: kind === "material" && qty > 0 && materialCost > 0 ? String(round2(materialCost / qty)) : "",
    toolId: String(item.toolId || ""),
    toolUnits: item.toolUnits != null ? String(item.toolUnits) : kind === "tool" ? "1" : "",
    days: item.days != null ? String(item.days) : kind === "tool" ? String(qty || 1) : "",
    measurementId: String(item.measurementId || ""),
    measurementItemId: String(item.measurementItemId || ""),
  });
}

export function lineToApi(line: EstimateLine) {
  const qty = lineQuantity(line);
  const materialCost = line.kind === "material" && line.unitPurchase ? String(round2(qty * num(line.unitPurchase))) : line.materialCost || "0";
  return {
    kind: line.kind,
    description: line.description.trim(),
    quantity: String(qty),
    unit: line.kind === "tool" ? "day" : line.unit || "nos",
    rate: line.rate.trim(),
    labourCost: line.labourCost || "0",
    materialCost,
    equipmentCost: line.equipmentCost || "0",
    otherCost: line.otherCost || "0",
    catalogMaterialId: line.catalogMaterialId || null,
    toolId: line.toolId || null,
    toolUnits: line.kind === "tool" ? line.toolUnits : null,
    days: line.kind === "tool" ? line.days : null,
    measurementId: line.measurementId || null,
    measurementItemId: line.measurementItemId || null,
  };
}

/** taxRate is stored as a fraction ("0.18"); the form uses a percent dropdown. */
export function gstPercentFrom(taxRate: unknown) {
  const pct = Math.round(num(taxRate) * 10000) / 100;
  return String(pct);
}
