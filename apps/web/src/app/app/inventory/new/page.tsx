"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="Add tool"
      backHref="/app/inventory"
      backLabel="Tools"
      successHref="/app/inventory"
      fields={[
        { key: "name", label: "Tool name", required: true },
        { key: "qty", label: "Quantity", type: "number", defaultValue: "1" },
        { key: "warehouse", label: "Warehouse", defaultValue: "main" },
        { key: "siteId", label: "Site (optional)", type: "relation", loadOptions: () => optionsFrom(athena.sites.list) },
      ]}
      onSubmit={(form) =>
        athena.inventory.create({
          name: form.name,
          qty: form.qty || "0",
          warehouse: form.warehouse || "main",
          siteId: form.siteId || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
