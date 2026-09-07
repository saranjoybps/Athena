"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.measurements.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit measurement"
      backHref="/app/measurements"
      backLabel="Measurements"
      load={load}
      save={async (form) => {
        const current = await athena.measurements.get(id);
        await athena.measurements.update(id, {
          customerId: current.customerId,
          siteId: current.siteId,
          surveyId: current.surveyId || null,
          formulaKind: form.formulaKind || current.formulaKind || "painting",
          originalUnit: form.originalUnit || "sqft",
          notes: form.notes || null,
          inputs: {
            wallArea: Number(form.wallArea || 0),
            ceilingArea: Number(form.ceilingArea || 0),
          },
        });
      }}
      mapToForm={(d) => {
        const inputs = (d.inputs as Record<string, unknown>) || {};
        return {
          formulaKind: String(d.formulaKind || "painting"),
          originalUnit: String(d.originalUnit || "sqft"),
          wallArea: String(inputs.wallArea ?? ""),
          ceilingArea: String(inputs.ceilingArea ?? ""),
          notes: String(d.notes || ""),
        };
      }}
      fields={[
        { key: "formulaKind", label: "Formula kind" },
        { key: "originalUnit", label: "Unit" },
        { key: "wallArea", label: "Wall area", type: "number" },
        { key: "ceilingArea", label: "Ceiling area", type: "number" },
        { key: "notes", label: "Notes", multiline: true },
      ]}
      subtitle={(d) => JSON.stringify(d.outputs || {})}
    />
  );
}
