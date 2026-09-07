"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="Add stock"
      backHref="/app/inventory"
      backLabel="Inventory"
      successHref="/app/inventory"
      fields={[
        { key: "materialId", label: "Material", type: "relation", required: true, loadOptions: () => optionsFrom(athena.materials.list) },
        { key: "qty", label: "Quantity", type: "number", defaultValue: "0" },
        { key: "warehouse", label: "Warehouse", defaultValue: "main" },
        { key: "siteId", label: "Site (optional)", type: "relation", loadOptions: () => optionsFrom(athena.sites.list) },
      ]}
      onSubmit={(form) =>
        athena.inventory.create({
          materialId: form.materialId,
          qty: form.qty || "0",
          warehouse: form.warehouse || "main",
          siteId: form.siteId || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
