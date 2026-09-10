"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [siteOpts, setSiteOpts] = useState<Array<{ value: string; label: string }>>([]);
  const load = useCallback(() => athena.inventory.get(id), [id]);

  useEffect(() => {
    optionsFrom(athena.sites.list)
      .then(setSiteOpts)
      .catch(() => setSiteOpts([]));
  }, []);

  return (
    <EditableDetailPage
      title="Edit tool"
      backHref="/app/inventory"
      backLabel="Tools"
      load={load}
      save={async (form) => {
        await athena.inventory.update(id, {
          name: form.name,
          qty: form.qty || "0",
          warehouse: form.warehouse || "main",
          siteId: form.siteId || null,
        });
      }}
      mapToForm={(d) => ({
        name: String(d.name || ""),
        qty: String(d.qty || "0"),
        warehouse: String(d.warehouse || "main"),
        siteId: String(d.siteId || ""),
      })}
      fields={[
        { key: "name", label: "Tool name" },
        { key: "qty", label: "Quantity", type: "number" },
        { key: "warehouse", label: "Warehouse" },
        {
          key: "siteId",
          label: "Site (optional)",
          options: [{ value: "", label: "—" }, ...siteOpts],
        },
      ]}
      subtitle={(d) => String(d.name || "Tool")}
    />
  );
}
