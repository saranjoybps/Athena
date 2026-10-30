/**
 * Site measurement sheet (IS 1200 style): every line is Nos × L × B/H in feet,
 * openings are deducted from the surface they sit in, and quantities are
 * grouped by work surface so each group becomes one estimate line.
 */

export const MEASUREMENT_TYPES = [
  { value: "room", label: "Room", hint: "L × W × H — gives walls, ceiling and floor" },
  { value: "wall", label: "Wall", hint: "Length × height" },
  { value: "ceiling", label: "Ceiling", hint: "Length × width" },
  { value: "floor", label: "Floor", hint: "Length × width" },
  { value: "deduction", label: "Door / window", hint: "Width × height, deducted" },
  { value: "running", label: "Running length", hint: "Skirting, cornice, grooves (rft)" },
  { value: "count", label: "Count", hint: "Items priced per number" },
  { value: "area", label: "Area", hint: "A single area in sq ft or sq m" },
  { value: "pieces", label: "Quantity", hint: "Pieces, units, or other counts" },
  { value: "length", label: "Length", hint: "Running feet or metres" },
  { value: "time", label: "Time", hint: "Hours or days" },
  { value: "fixed", label: "Fixed scope", hint: "One defined job at an agreed price" },
  { value: "custom", label: "Other quantity", hint: "Any quantity and unit" },
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]["value"];

export type GroupKey = "walls" | "ceiling" | "floor" | "otherArea" | "rft" | "nos";

export const GROUPS: { key: GroupKey; label: string; unit: string }[] = [
  { key: "walls", label: "Walls", unit: "sqft" },
  { key: "ceiling", label: "Ceiling", unit: "sqft" },
  { key: "floor", label: "Floor", unit: "sqft" },
  { key: "otherArea", label: "Other area", unit: "sqft" },
  { key: "rft", label: "Running length", unit: "rft" },
  { key: "nos", label: "Count", unit: "nos" },
];

export const DEDUCT_FROM = [
  { id: "walls", label: "Walls" },
  { id: "ceiling", label: "Ceiling" },
  { id: "floor", label: "Floor" },
];

export const SURFACES = [
  { id: "walls", label: "Walls" },
  { id: "ceiling", label: "Ceiling" },
  { id: "floor", label: "Floor" },
  { id: "otherArea", label: "Other area" },
];

export const CUSTOM_UNITS = [
  { id: "sqft", label: "sqft" },
  { id: "rft", label: "rft (running feet)" },
  { id: "nos", label: "nos (count)" },
  { id: "piece", label: "piece" },
  { id: "hours", label: "hours" },
  { id: "days", label: "days" },
  { id: "job", label: "job" },
  { id: "cft", label: "cft (cubic feet)" },
  { id: "sqm", label: "sqm" },
  { id: "rmt", label: "rmt (running metre)" },
  { id: "kg", label: "kg" },
  { id: "ltr", label: "litre" },
];

export type MeasurementFieldDef = {
  key: string;
  label: string;
  unit?: string;
  kind?: "number" | "text" | "deductFrom" | "unit" | "surface";
  required?: boolean;
  defaultValue?: string;
  integer?: boolean;
};

export type MeasurementItem = {
  id: string;
  type: MeasurementType;
  label: string;
  values: Record<string, string>;
  outputs: Record<string, number | string>;
  operation?: "add" | "subtract";
};

export function newItemId() {
  return `mi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const NOS: MeasurementFieldDef = { key: "nos", label: "Nos", kind: "number", defaultValue: "1", integer: true, required: true };

export function fieldsForType(type: MeasurementType): MeasurementFieldDef[] {
  switch (type) {
    case "room":
      return [
        { key: "length", label: "Length", unit: "ft", kind: "number", required: true },
        { key: "width", label: "Width", unit: "ft", kind: "number", required: true },
        { key: "height", label: "Height", unit: "ft", kind: "number", required: true },
        { key: "openings", label: "Doors & windows to deduct", unit: "sqft", kind: "number" },
      ];
    case "wall":
      return [
        { key: "length", label: "Length", unit: "ft", kind: "number", required: true },
        { key: "height", label: "Height", unit: "ft", kind: "number", required: true },
        NOS,
      ];
    case "ceiling":
    case "floor":
      return [
        { key: "length", label: "Length", unit: "ft", kind: "number", required: true },
        { key: "width", label: "Width", unit: "ft", kind: "number", required: true },
        NOS,
      ];
    case "deduction":
      return [
        { key: "width", label: "Width", unit: "ft", kind: "number", required: true },
        { key: "height", label: "Height", unit: "ft", kind: "number", required: true },
        NOS,
        { key: "deductFrom", label: "Deduct from", kind: "deductFrom", defaultValue: "walls" },
      ];
    case "running":
      return [{ key: "length", label: "Length", unit: "ft", kind: "number", required: true }, NOS];
    case "count":
      return [{ key: "nos", label: "Number of items", kind: "number", required: true, integer: true, defaultValue: "1" }];
    case "area":
      return [
        { key: "length", label: "Length", unit: "ft", kind: "number" },
        { key: "width", label: "Width", unit: "ft", kind: "number" },
        { key: "quantity", label: "Or enter area", kind: "number" },
        { key: "unit", label: "Unit", kind: "unit", defaultValue: "sqft" },
      ];
    case "pieces":
      return [
        { key: "quantity", label: "Quantity", kind: "number", required: true },
        { key: "unit", label: "Unit", kind: "unit", defaultValue: "piece" },
      ];
    case "length":
      return [
        { key: "length", label: "Segment length", kind: "number", required: true },
        { key: "count", label: "Segments", kind: "number", defaultValue: "1", integer: true },
        { key: "unit", label: "Unit", kind: "unit", defaultValue: "rft" },
      ];
    case "time":
      return [
        { key: "duration", label: "Duration", kind: "number", required: true },
        { key: "unit", label: "Unit", kind: "unit", defaultValue: "hours" },
      ];
    case "fixed":
      return [{ key: "detail", label: "Scope detail", kind: "text" }];
    default:
      return [
        { key: "quantity", label: "Quantity", kind: "number", required: true },
        { key: "unit", label: "Unit", kind: "unit", defaultValue: "sqft" },
        { key: "surface", label: "Counts as", kind: "surface", defaultValue: "otherArea" },
      ];
  }
}

export function typeMeta(type: MeasurementType) {
  return MEASUREMENT_TYPES.find((t) => t.value === type) || MEASUREMENT_TYPES[MEASUREMENT_TYPES.length - 1];
}

export function typeLabel(type: MeasurementType) {
  return typeMeta(type).label;
}

export function emptyValues(type: MeasurementType): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fieldsForType(type)) values[f.key] = f.defaultValue || "";
  return values;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Group totals contributed by one line (deductions are negative). */
export function computeItemOutputs(type: MeasurementType, values: Record<string, string>): Record<string, number | string> {
  const n = (k: string) => {
    const v = Number(values[k]);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const nos = values.nos === undefined || values.nos === "" ? 1 : n("nos");
  switch (type) {
    case "room": {
      const gross = 2 * (n("length") + n("width")) * n("height");
      const walls = Math.max(0, gross - n("openings"));
      const plan = n("length") * n("width");
      return {
        walls: round2(walls),
        ceiling: round2(plan),
        floor: round2(plan),
        grossWallArea: round2(gross),
        quantity: round2(walls),
        unit: "sqft",
      };
    }
    case "wall": {
      const walls = n("length") * n("height") * nos;
      return { walls: round2(walls), quantity: round2(walls), unit: "sqft" };
    }
    case "ceiling":
    case "floor": {
      const area = n("length") * n("width") * nos;
      return { [type]: round2(area), quantity: round2(area), unit: "sqft" };
    }
    case "deduction": {
      const area = n("width") * n("height") * nos;
      const target = (["walls", "ceiling", "floor"].includes(values.deductFrom) ? values.deductFrom : "walls") as GroupKey;
      return { [target]: -round2(area), quantity: round2(area), unit: "sqft", deductFrom: target };
    }
    case "running": {
      const rft = n("length") * nos;
      return { rft: round2(rft), quantity: round2(rft), unit: "rft" };
    }
    case "count": {
      const count = n("nos");
      return { nos: count, quantity: count, unit: "nos" };
    }
    case "area": {
      const fromSides = n("length") > 0 && n("width") > 0 ? n("length") * n("width") : 0;
      const quantity = fromSides || n("quantity");
      const unit = values.unit === "sqm" ? "sqm" : "sqft";
      return { quantity: round2(quantity), unit, ...(unit === "sqft" ? { otherArea: round2(quantity) } : {}) };
    }
    case "pieces": {
      const quantity = n("quantity");
      const unit = values.unit || "piece";
      return { quantity: round2(quantity), unit, ...(unit === "nos" ? { nos: quantity } : {}) };
    }
    case "length": {
      const quantity = n("length") * (values.count === undefined || values.count === "" ? 1 : n("count") || 1);
      const unit = ["rft", "ft", "m", "rmt"].includes(values.unit) ? values.unit : "rft";
      return { quantity: round2(quantity), unit, ...(unit === "rft" ? { rft: round2(quantity) } : {}) };
    }
    case "time": {
      const quantity = n("duration");
      const unit = values.unit === "days" ? "days" : "hours";
      return { quantity: round2(quantity), unit };
    }
    case "fixed":
      return { quantity: 1, unit: "job" };
    default: {
      const unit = values.unit || "sqft";
      const q = n("quantity");
      const surface = ["walls", "ceiling", "floor"].includes(values.surface) ? values.surface : "otherArea";
      const group = unit === "sqft" ? surface : unit === "rft" ? "rft" : unit === "nos" ? "nos" : null;
      return { ...(group ? { [group]: round2(q) } : {}), quantity: round2(q), unit };
    }
  }
}

export function createMeasurementItem(type: MeasurementType = "room", label = ""): MeasurementItem {
  const values = emptyValues(type);
  return {
    id: newItemId(),
    type,
    label: label || "",
    values,
    outputs: computeItemOutputs(type, values),
    operation: type === "deduction" ? "subtract" : "add",
  };
}

export function recomputeItem(item: MeasurementItem): MeasurementItem {
  return {
    ...item,
    operation: item.type === "deduction" ? "subtract" : item.operation === "subtract" ? "subtract" : "add",
    outputs: computeItemOutputs(item.type, item.values),
  };
}

/** Lines marked "−" take their quantities off the totals (door/window lines always do). */
export function isSubtracted(item: MeasurementItem) {
  return item.type === "deduction" || item.operation === "subtract";
}

/** Lines whose required inputs are missing or zero. */
export function invalidItems(items: MeasurementItem[]) {
  return items.filter((item) =>
    fieldsForType(item.type).some((f) => f.required && f.kind === "number" && !(Number(item.values[f.key]) > 0)),
  );
}

export type GroupTotal = { key: GroupKey | string; label: string; quantity: number; unit: string };

export function aggregateOutputs(items: MeasurementItem[]) {
  const sums: Record<GroupKey, number> = { walls: 0, ceiling: 0, floor: 0, otherArea: 0, rft: 0, nos: 0 };
  let deductions = 0;
  const extra: Record<string, number> = {};
  for (const item of items) {
    const out = item.outputs;
    // Door/window outputs are already negative; other lines flip sign when marked "−".
    const sign = item.type !== "deduction" && item.operation === "subtract" ? -1 : 1;
    for (const g of GROUPS) {
      const v = Number(out[g.key]);
      if (Number.isFinite(v)) sums[g.key] += sign * v;
    }
    if (isSubtracted(item) && String(out.unit || "sqft") === "sqft") deductions += Number(out.quantity || 0);
    if (["custom", "area", "pieces", "length", "time", "fixed"].includes(item.type) && !["sqft", "rft", "nos"].includes(String(out.unit))) {
      const unit = String(out.unit);
      extra[unit] = (extra[unit] || 0) + sign * Number(out.quantity || 0);
    }
  }
  for (const g of GROUPS) sums[g.key] = round2(Math.max(0, sums[g.key]));
  const groups: GroupTotal[] = GROUPS.filter((g) => sums[g.key] > 0).map((g) => ({
    key: g.key,
    label: g.label,
    quantity: sums[g.key],
    unit: g.unit,
  }));
  for (const [unit, q] of Object.entries(extra)) {
    if (q > 0) groups.push({ key: `unit:${unit}`, label: `Other (${unit})`, quantity: round2(q), unit });
  }
  const totalArea = round2(sums.walls + sums.ceiling + sums.floor + sums.otherArea);
  return {
    itemCount: items.length,
    walls: sums.walls,
    ceiling: sums.ceiling,
    floor: sums.floor,
    otherArea: sums.otherArea,
    rft: sums.rft,
    nos: sums.nos,
    deductions: round2(deductions),
    groups,
    /** All surfaces, kept for older readers of `totalArea`. */
    totalArea,
    paintableArea: round2(sums.walls + sums.ceiling),
    quantity: totalArea,
    unit: "sqft",
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      operation: item.operation || "add",
      quantity: Number(item.outputs.quantity || 0),
      unit: String(item.outputs.unit || "sqft"),
    })),
  };
}

export function itemTitle(item: MeasurementItem, index: number) {
  return item.label.trim() || `${typeLabel(item.type)} ${index + 1}`;
}

/** One-line result shown under each measurement line. */
export function itemResult(item: MeasurementItem) {
  const o = item.outputs;
  const fmt = (v: unknown) => formatQty(Number(v || 0));
  const sign = isSubtracted(item) ? "− " : "+ ";
  switch (item.type) {
    case "room":
      return `${sign}Walls ${fmt(o.walls)} · Ceiling ${fmt(o.ceiling)} · Floor ${fmt(o.floor)} sqft`;
    case "deduction":
      return `− ${fmt(o.quantity)} sqft from ${String(o.deductFrom || "walls")}`;
    default:
      return `${sign}${fmt(o.quantity)} ${String(o.unit || "sqft")}`;
  }
}

export function formatQty(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const LEGACY_TYPES = new Set(["four_walls", "lwh", "door", "window", "opening"]);

/** Convert lines saved by the previous editor so old measurements open with the same quantities. */
function fromLegacy(type: string, values: Record<string, string>, label: string): MeasurementItem {
  const num = (k: string) => Number(values[k] || 0) || 0;
  switch (type) {
    case "four_walls":
      return createWith("custom", label || "Walls", {
        quantity: String(num("wall1") + num("wall2") + num("wall3") + num("wall4")),
        unit: "sqft",
        surface: "walls",
      });
    case "lwh":
      return createWith("room", label, { length: values.length, width: values.width, height: values.height, openings: "" });
    case "door":
    case "window":
    case "opening":
      return createWith("deduction", label || typeLabel("deduction"), {
        width: values.width,
        height: values.height,
        nos: values.count || "1",
        deductFrom: "walls",
      });
    case "area":
      return createWith("custom", label, { quantity: values.area, unit: "sqft" });
    default:
      return createWith("custom", label, { quantity: values.value, unit: values.unit || "sqft" });
  }
}

function createWith(type: MeasurementType, label: string, values: Record<string, string | undefined>) {
  const base = createMeasurementItem(type, label);
  const clean: Record<string, string> = { ...base.values };
  for (const [k, v] of Object.entries(values)) clean[k] = v == null ? "" : String(v);
  return recomputeItem({ ...base, values: clean });
}

export function parseMeasurementItems(doc: Record<string, unknown>): MeasurementItem[] {
  const inputs = (doc.inputs as Record<string, unknown>) || {};
  const rawItems = inputs.items;
  const known = new Set<string>(MEASUREMENT_TYPES.map((t) => t.value));
  if (Array.isArray(rawItems) && rawItems.length) {
    return rawItems.map((raw) => {
      const row = raw as Record<string, unknown>;
      const type = String(row.type || "custom");
      const values = Object.fromEntries(
        Object.entries((row.values as Record<string, unknown>) || {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
      );
      const label = String(row.label || "");
      const operation = row.operation === "subtract" ? "subtract" : "add";
      const withSign = (item: MeasurementItem) => recomputeItem({ ...item, operation: item.type === "deduction" ? "subtract" : operation });
      if (type === "room" && ("doors" in values || "windows" in values) && !("openings" in values)) {
        const openings = (Number(values.doors) || 0) + (Number(values.windows) || 0);
        return withSign(createWith("room", label, { ...values, openings: openings ? String(openings) : "" }));
      }
      const legacyCustom = type === "custom" && "value" in values && !("quantity" in values);
      if (legacyCustom || LEGACY_TYPES.has(type) || !known.has(type)) return withSign(fromLegacy(type, values, label));
      return recomputeItem({ id: String(row.id || newItemId()), type: type as MeasurementType, label, values, outputs: {}, operation });
    });
  }
  // Single-formula measurements from before the sheet editor.
  const type = String(inputs.measurementType || doc.formulaKind || "custom");
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (k === "items" || k === "measurementType") continue;
    values[k] = String(v ?? "");
  }
  if (!Object.keys(values).length) {
    const outs = (doc.outputs as Record<string, unknown>) || {};
    const q = outs.totalArea ?? outs.paintableArea ?? outs.wallArea ?? outs.quantity;
    if (q == null) return [];
    return [createWith("custom", String(doc.notes || ""), { quantity: String(q), unit: String(outs.unit || "sqft") })];
  }
  const label = String(doc.title || doc.notes || "");
  if (type === "area") return [createWith("area", label, { length: values.length, width: values.width, quantity: values.quantity, unit: values.unit || "sqft" })];
  if (type === "quantity") return [createWith("pieces", label, { quantity: values.quantity || values.count, unit: values.unit || "piece" })];
  if (type === "length") return [createWith("length", label, { length: values.length, count: values.count || "1", unit: values.unit || "rft" })];
  if (type === "time") return [createWith("time", label, { duration: values.duration || values.quantity, unit: values.unit || "hours" })];
  if (type === "fixed") return [createWith("fixed", label, { detail: values.description || "" })];
  return [fromLegacy(type, values, label)];
}

export function measurementTitle(m: Record<string, unknown>) {
  return String(m.title || "").trim() || String(m.notes || "").trim().split("\n")[0] || "Measurement";
}

export function buildMeasurementPayload(
  items: MeasurementItem[],
  opts: { title: string; notes: string | null; billBySqft?: boolean; perSqftRate?: string | null; photos?: Array<Record<string, unknown>> },
) {
  const recomputed = items.map(recomputeItem);
  const outputs = aggregateOutputs(recomputed);
  return {
    title: opts.title,
    formulaKind: "composite",
    originalUnit: "sqft",
    notes: opts.notes,
    billBySqft: Boolean(opts.billBySqft),
    perSqftRate: opts.billBySqft ? opts.perSqftRate || null : null,
    photos: opts.photos || [],
    inputs: { measurementType: "composite", items: recomputed },
    formulaConfig: { outputs },
  };
}

/** Grouped totals of a saved measurement (re-derived so legacy rows get the same groups). */
export function measurementGroups(m: Record<string, unknown>): GroupTotal[] {
  const inputs = (m.inputs as Record<string, unknown>) || {};
  if (Array.isArray(inputs.items) || inputs.measurementType) return aggregateOutputs(parseMeasurementItems(m)).groups;
  const saved = ((m.formulaConfig as Record<string, unknown>)?.outputs as Record<string, unknown>)?.groups;
  if (Array.isArray(saved)) return saved as GroupTotal[];
  return aggregateOutputs(parseMeasurementItems(m)).groups;
}

export function measurementSummary(m: Record<string, unknown>): string {
  const outputs = (m.outputs as Record<string, unknown>) || {};
  const scope = String(m.measurementType || outputs.measurementType || "");
  if (["area", "quantity", "length", "time", "fixed"].includes(scope) && outputs.quantity != null) {
    const formula = outputs.formula ? ` — ${outputs.formula}` : "";
    return `${outputs.quantity} ${outputs.unit || ""}${formula}`.trim();
  }
  const groups = measurementGroups(m);
  if (!groups.length) return "No quantities yet";
  return groups
    .slice(0, 3)
    .map((g) => `${g.label} ${formatQty(g.quantity)} ${g.unit}`)
    .join(" · ");
}

export type MeasurementLineOption = {
  id: string;
  label: string;
  detail: string;
  description: string;
  quantity: number;
  unit: string;
  measurementId: string;
  group: string;
  billingMethod?: "area" | "quantity" | "length" | "time" | "fixed";
};

const BILLING_BY_TYPE: Record<string, "area" | "quantity" | "length" | "time" | "fixed"> = {
  room: "area",
  wall: "area",
  ceiling: "area",
  floor: "area",
  area: "area",
  count: "quantity",
  pieces: "quantity",
  running: "length",
  length: "length",
  time: "time",
  fixed: "fixed",
};

/** One option per measurement line — each becomes its own estimate work item. */
export function measurementLineOptions(measurements: Array<Record<string, unknown>>): MeasurementLineOption[] {
  const options: MeasurementLineOption[] = [];
  for (const m of measurements) {
    const title = measurementTitle(m);
    const lines = parseMeasurementItems(m).filter((item) => Number(item.outputs.quantity) > 0 && item.type !== "deduction");
    if (lines.length) {
      for (const item of lines) {
        const quantity = Number(item.outputs.quantity || 0);
        const unit = String(item.outputs.unit || "");
        const name = item.label.trim() || typeLabel(item.type);
        options.push({
          id: `${m.id}::${item.id}`,
          label: `${name} — ${formatQty(quantity)} ${unit}`,
          detail: `${typeLabel(item.type)} · ${title}`,
          description: `${name} (${title})`,
          quantity,
          unit,
          measurementId: String(m.id),
          group: item.id,
          billingMethod: BILLING_BY_TYPE[item.type],
        });
      }
      continue;
    }
    const outputs = (m.outputs as Record<string, unknown>) || {};
    const scope = String(m.measurementType || outputs.measurementType || "");
    if (["area", "quantity", "length", "time", "fixed"].includes(scope) && outputs.quantity != null) {
      options.push({
        id: `${m.id}::${scope}`,
        label: `${title} — ${formatQty(Number(outputs.quantity))} ${outputs.unit || ""}`,
        detail: String(outputs.formula || title),
        description: title,
        quantity: Number(outputs.quantity),
        unit: String(outputs.unit || (scope === "fixed" ? "job" : "")),
        measurementId: String(m.id),
        group: scope,
      });
      continue;
    }
    for (const g of measurementGroups(m)) {
      options.push({
        id: `${m.id}::${g.key}`,
        label: `${g.label} — ${formatQty(g.quantity)} ${g.unit}`,
        detail: title,
        description: `${g.label} (${title})`,
        quantity: g.quantity,
        unit: g.unit,
        measurementId: String(m.id),
        group: String(g.key),
      });
    }
  }
  return options;
}
