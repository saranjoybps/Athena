"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.crews.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit crew"
      backHref="/app/crews"
      backLabel="Crews"
      load={load}
      save={(form) =>
        athena.crews.update(id, {
          name: form.name,
          trade: form.trade || null,
          dailyCost: form.dailyCost || null,
          expectedProductivity: form.expectedProductivity || null,
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || ""),
        trade: String(d.trade || ""),
        dailyCost: String(d.dailyCost || ""),
        expectedProductivity: String(d.expectedProductivity || ""),
      })}
      fields={[
        { key: "name", label: "Name" },
        { key: "trade", label: "Trade" },
        { key: "dailyCost", label: "Daily cost" },
        { key: "expectedProductivity", label: "Expected productivity" },
      ]}
    />
  );
}
