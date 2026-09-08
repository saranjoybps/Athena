"use client";

import { useMemo, useState } from "react";
import {
  MEASUREMENT_TYPES,
  createMeasurementItem,
  fieldsForType,
  recomputeItem,
  aggregateOutputs,
  type MeasurementItem,
  type MeasurementType,
} from "@/lib/measurements";

type Props = {
  items: MeasurementItem[];
  onChange: (items: MeasurementItem[]) => void;
};

export function MeasurementEditor({ items, onChange }: Props) {
  const [draftType, setDraftType] = useState<MeasurementType>("area");
  const totals = useMemo(() => aggregateOutputs(items.map(recomputeItem)), [items]);

  function updateItem(id: string, patch: Partial<MeasurementItem>) {
    onChange(items.map((item) => (item.id === id ? recomputeItem({ ...item, ...patch }) : item)));
  }

  function updateValue(id: string, key: string, value: string) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        return recomputeItem({ ...item, values: { ...item.values, [key]: value } });
      }),
    );
  }

  function changeType(id: string, type: MeasurementType) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = createMeasurementItem(type, item.label);
        next.id = item.id;
        return next;
      }),
    );
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([...items, createMeasurementItem(draftType)]);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-stone-800">Measurement items</p>
          <p className="text-sm text-stone-500">Add walls, rooms, openings, and other takeoffs. Totals update live.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-stone-600">Type</span>
            <select className="rounded-xl border px-3 py-2" value={draftType} onChange={(e) => setDraftType(e.target.value as MeasurementType)}>
              {MEASUREMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addItem} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
            Add item
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-stone-500">No items yet. Add at least one measurement item.</p>
      ) : null}

      {items.map((item, index) => (
        <div key={item.id} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Item {index + 1} label</span>
                <input
                  className="rounded-xl border px-3 py-2"
                  value={item.label}
                  onChange={(e) => updateItem(item.id, { label: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Type</span>
                <select
                  className="rounded-xl border px-3 py-2"
                  value={item.type}
                  onChange={(e) => changeType(item.id, e.target.value as MeasurementType)}
                >
                  {MEASUREMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="text-sm text-red-700" onClick={() => removeItem(item.id)}>
              Remove
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fieldsForType(item.type).map((field) => (
              <label key={field.key} className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <input
                  className="rounded-xl border px-3 py-2"
                  type={field.type || "text"}
                  value={item.values[field.key] || ""}
                  onChange={(e) => updateValue(item.id, field.key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <p className="text-sm text-stone-600">
            Calculated: {String(item.outputs.quantity || 0)} {String(item.outputs.unit || "sqft")}
            {item.outputs.paintableArea != null ? ` · paintable ${item.outputs.paintableArea}` : ""}
          </p>
        </div>
      ))}

      <div className="rounded-2xl border border-stone-200 bg-sand/50 p-4 text-sm">
        <p className="font-medium text-stone-800">Totals</p>
        <p className="mt-1 text-stone-700">
          {totals.itemCount} items · total area {totals.totalArea} sqft · paintable {totals.paintableArea} sqft
        </p>
      </div>
    </div>
  );
}
