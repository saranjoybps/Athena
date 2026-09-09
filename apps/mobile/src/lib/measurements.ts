export const MEASUREMENT_TYPES = [
  { value: "four_walls", label: "Four walls" },
  { value: "lwh", label: "Length × Width × Height" },
  { value: "ceiling", label: "Ceiling" },
  { value: "door", label: "Door" },
  { value: "window", label: "Window" },
  { value: "opening", label: "Opening" },
  { value: "room", label: "Room" },
  { value: "area", label: "Area" },
  { value: "custom", label: "Custom / other" },
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]["value"];

export type MeasurementFieldDef = {
  key: string;
  label: string;
  type?: "text" | "number";
  required?: boolean;
  defaultValue?: string;
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

export function fieldsForType(type: MeasurementType): MeasurementFieldDef[] {
  switch (type) {
    case "four_walls":
      return [
        { key: "wall1", label: "Wall 1 (L×H sqft)", type: "number", required: true },
        { key: "wall2", label: "Wall 2 (L×H sqft)", type: "number", required: true },
        { key: "wall3", label: "Wall 3 (L×H sqft)", type: "number", required: true },
        { key: "wall4", label: "Wall 4 (L×H sqft)", type: "number", required: true },
      ];
    case "lwh":
      return [
        { key: "length", label: "Length", type: "number", required: true },
        { key: "width", label: "Width", type: "number", required: true },
        { key: "height", label: "Height", type: "number", required: true },
      ];
    case "ceiling":
      return [
        { key: "length", label: "Length", type: "number", required: true },
        { key: "width", label: "Width", type: "number", required: true },
      ];
    case "door":
    case "window":
    case "opening":
      return [
        { key: "width", label: "Width", type: "number", required: true },
        { key: "height", label: "Height", type: "number", required: true },
        { key: "count", label: "Count", type: "number", required: true, defaultValue: "1" },
      ];
    case "room":
      return [
        { key: "length", label: "Length", type: "number", required: true },
        { key: "width", label: "Width", type: "number", required: true },
        { key: "height", label: "Height", type: "number", required: true },
        { key: "doors", label: "Door openings (sqft)", type: "number", defaultValue: "0" },
        { key: "windows", label: "Window openings (sqft)", type: "number", defaultValue: "0" },
      ];
    case "area":
      return [{ key: "area", label: "Area (sqft)", type: "number", required: true }];
    default:
      return [
        { key: "label", label: "Label", required: true },
        { key: "value", label: "Value", type: "number", required: true },
        { key: "unit", label: "Unit", defaultValue: "sqft" },
      ];
  }
}

export function typeLabel(type: MeasurementType) {
  return MEASUREMENT_TYPES.find((t) => t.value === type)?.label || type;
}

export function emptyValues(type: MeasurementType): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fieldsForType(type)) values[f.key] = f.defaultValue || "";
  return values;
}

export function computeItemOutputs(type: MeasurementType, values: Record<string, string>): Record<string, number | string> {
  const n = (k: string) => Number(values[k] || 0);
  switch (type) {
    case "four_walls": {
      const wallArea = n("wall1") + n("wall2") + n("wall3") + n("wall4");
      return { wallArea, totalArea: wallArea, quantity: wallArea, unit: "sqft" };
    }
    case "lwh": {
      const wallArea = 2 * (n("length") + n("width")) * n("height");
      const floorArea = n("length") * n("width");
      return {
        length: n("length"),
        width: n("width"),
        height: n("height"),
        wallArea,
        floorArea,
        volume: n("length") * n("width") * n("height"),
        totalArea: wallArea,
        quantity: wallArea,
        unit: "sqft",
      };
    }
    case "ceiling": {
      const ceilingArea = n("length") * n("width");
      return { ceilingArea, totalArea: ceilingArea, quantity: ceilingArea, unit: "sqft" };
    }
    case "door":
    case "window":
    case "opening": {
      const count = n("count") || 1;
      const unitArea = n("width") * n("height");
      const totalArea = unitArea * count;
      return { unitArea, count, totalArea, quantity: totalArea, unit: "sqft" };
    }
    case "room": {
      const wallArea = 2 * (n("length") + n("width")) * n("height");
      const openings = n("doors") + n("windows");
      const paintableArea = Math.max(0, wallArea - openings);
      const floorArea = n("length") * n("width");
      return {
        wallArea,
        openings,
        paintableArea,
        floorArea,
        ceilingArea: floorArea,
        totalArea: paintableArea,
        quantity: paintableArea,
        unit: "sqft",
      };
    }
    case "area":
      return { area: n("area"), totalArea: n("area"), quantity: n("area"), unit: "sqft" };
    default:
      return {
        label: values.label || "custom",
        value: n("value"),
        quantity: n("value"),
        unit: values.unit || "sqft",
        totalArea: n("value"),
      };
  }
}

export function createMeasurementItem(type: MeasurementType = "area", label = ""): MeasurementItem {
  const values = emptyValues(type);
  return {
    id: newItemId(),
    type,
    label: label || typeLabel(type),
    values,
    outputs: computeItemOutputs(type, values),
    operation: "add",
  };
}

export function recomputeItem(item: MeasurementItem): MeasurementItem {
  return {
    ...item,
    outputs: computeItemOutputs(item.type, item.values),
  };
}

export function aggregateOutputs(items: MeasurementItem[]) {
  const totalArea = items.reduce((sum, item) => {
    const raw = Number(item.outputs.totalArea || item.outputs.quantity || 0);
    return sum + ((item.operation || "add") === "subtract" ? -raw : raw);
  }, 0);
  const paintableArea = items.reduce((sum, item) => {
    const raw = Number(item.outputs.paintableArea || item.outputs.totalArea || item.outputs.quantity || 0);
    return sum + ((item.operation || "add") === "subtract" ? -raw : raw);
  }, 0);
  return {
    itemCount: items.length,
    totalArea,
    paintableArea,
    quantity: totalArea,
    unit: "sqft",
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      operation: item.operation || "add",
      quantity: Number(item.outputs.quantity || 0),
      unit: String(item.outputs.unit || "sqft"),
      outputs: item.outputs,
    })),
  };
}

export function primaryQuantity(outputs: Record<string, unknown> | null | undefined): number {
  if (!outputs) return 0;
  const keys = ["quantity", "paintableArea", "totalArea", "wallArea", "ceilingArea", "area", "value"];
  for (const key of keys) {
    const n = Number(outputs[key]);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

export function parseMeasurementItems(doc: Record<string, unknown>): MeasurementItem[] {
  const inputs = (doc.inputs as Record<string, unknown>) || {};
  const rawItems = inputs.items;
  if (Array.isArray(rawItems) && rawItems.length) {
    return rawItems.map((raw) => {
      const row = raw as Record<string, unknown>;
      const type = String(row.type || "area") as MeasurementType;
      const values = (row.values as Record<string, string>) || {};
      const item: MeasurementItem = {
        id: String(row.id || newItemId()),
        type: MEASUREMENT_TYPES.some((t) => t.value === type) ? type : "custom",
        label: String(row.label || typeLabel(type)),
        values,
        outputs: (row.outputs as Record<string, number | string>) || computeItemOutputs(type, values),
        operation: row.operation === "subtract" ? "subtract" : "add",
      };
      return recomputeItem(item);
    });
  }

  const type = String(inputs.measurementType || doc.formulaKind || "area") as MeasurementType;
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (k === "items" || k === "measurementType") continue;
    values[k] = String(v ?? "");
  }
  if (!Object.keys(values).length) {
    const outs = (doc.outputs as Record<string, unknown>) || {};
    if (outs.wallArea != null) values.wall1 = String(outs.wallArea);
  }
  const item = createMeasurementItem(
    MEASUREMENT_TYPES.some((t) => t.value === type) ? type : "custom",
    String(doc.notes || typeLabel(type)),
  );
  item.values = { ...item.values, ...values };
  return [recomputeItem(item)];
}

export function buildMeasurementPayload(items: MeasurementItem[], notes: string | null) {
  const recomputed = items.map(recomputeItem);
  const outputs = aggregateOutputs(recomputed);
  return {
    formulaKind: "composite",
    originalUnit: "sqft",
    notes,
    inputs: {
      measurementType: "composite",
      items: recomputed,
    },
    formulaConfig: { outputs },
  };
}

export function measurementLineOptions(measurements: Array<Record<string, unknown>>) {
  const options: Array<{
    value: string;
    label: string;
    quantity: number;
    unit: string;
    measurementId: string;
    itemId: string;
  }> = [];
  for (const m of measurements) {
    const items = parseMeasurementItems(m);
    const measurementId = String(m.id);
    for (const item of items) {
      const qty = primaryQuantity(item.outputs);
      options.push({
        value: `${measurementId}::${item.id}`,
        label: `${item.label} · ${qty} ${item.outputs.unit || "sqft"} (${String(m.formulaKind || "measurement")})`,
        quantity: qty,
        unit: String(item.outputs.unit || "sqft"),
        measurementId,
        itemId: item.id,
      });
    }
  }
  return options;
}
