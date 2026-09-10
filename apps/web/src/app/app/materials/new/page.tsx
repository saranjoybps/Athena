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
        { key: "hsn", label: "HSN code" },
        { key: "gstRate", label: "GST rate (e.g. 0.18 for 18%)", defaultValue: "0.18" },
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
          gstRate: form.gstRate ? Number(form.gstRate) : 0.18,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
