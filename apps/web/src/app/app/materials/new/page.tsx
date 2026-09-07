"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New material"
      backHref="/app/materials"
      backLabel="Materials"
      successHref="/app/materials"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "brand", label: "Brand" },
        { key: "category", label: "Category" },
        { key: "unit", label: "Unit", defaultValue: "pcs" },
        { key: "defaultPurchasePrice", label: "Purchase price" },
        { key: "defaultSellingPrice", label: "Selling price" },
        { key: "minimumStock", label: "Minimum stock" },
        { key: "hsn", label: "HSN" },
      ]}
      onSubmit={(form) =>
        athena.materials.create({
          name: form.name,
          brand: form.brand || null,
          category: form.category || null,
          unit: form.unit || "pcs",
          defaultPurchasePrice: form.defaultPurchasePrice || null,
          defaultSellingPrice: form.defaultSellingPrice || null,
          minimumStock: form.minimumStock || null,
          hsn: form.hsn || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
