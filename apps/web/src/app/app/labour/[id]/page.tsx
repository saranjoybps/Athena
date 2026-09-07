"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function LabourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.labour.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit labour"
      backHref="/app/labour"
      backLabel="Labour"
      load={load}
      save={(form) =>
        athena.labour.update(id, {
          name: form.name,
          phone: form.phone || null,
          trade: form.trade || null,
          skill: form.skill || null,
          dailyRate: form.dailyRate || null,
          workerType: form.workerType || "employee",
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || ""),
        phone: String(d.phone || ""),
        trade: String(d.trade || ""),
        skill: String(d.skill || ""),
        dailyRate: String(d.dailyRate || ""),
        workerType: String(d.workerType || "employee"),
      })}
      fields={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "trade", label: "Trade" },
        { key: "skill", label: "Skill" },
        { key: "dailyRate", label: "Daily rate" },
        {
          key: "workerType",
          label: "Type",
          options: [
            { value: "employee", label: "Employee" },
            { value: "contractor", label: "Contractor" },
          ],
        },
      ]}
    />
  );
}
