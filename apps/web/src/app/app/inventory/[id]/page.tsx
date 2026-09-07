"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.inventory.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit stock"
      backHref="/app/inventory"
      backLabel="Inventory"
      load={load}
      save={async (form) => {
        const current = await athena.inventory.get(id);
        await athena.inventory.update(id, {
          materialId: current.materialId,
          qty: form.qty || "0",
          warehouse: form.warehouse || "main",
          siteId: form.siteId || null,
        });
      }}
      mapToForm={(d) => ({
        qty: String(d.qty || "0"),
        warehouse: String(d.warehouse || "main"),
        siteId: String(d.siteId || ""),
      })}
      fields={[
        { key: "qty", label: "Quantity", type: "number" },
        { key: "warehouse", label: "Warehouse" },
        { key: "siteId", label: "Site id (optional)" },
      ]}
      subtitle={(d) => "Stock record"}
    />
  );
}
