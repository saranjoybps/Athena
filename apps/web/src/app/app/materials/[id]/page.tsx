"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.materials.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit material"
      backHref="/app/materials"
      backLabel="Materials"
      load={load}
      save={(form) =>
        athena.materials.update(id, {
          name: form.name,
          brand: form.brand || null,
          category: form.category || null,
          unit: form.unit || "pcs",
          defaultPurchasePrice: form.defaultPurchasePrice || null,
          defaultSellingPrice: form.defaultSellingPrice || null,
          minimumStock: form.minimumStock || null,
          hsn: form.hsn || null,
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || ""),
        brand: String(d.brand || ""),
        category: String(d.category || ""),
        unit: String(d.unit || "pcs"),
        defaultPurchasePrice: String(d.defaultPurchasePrice || ""),
        defaultSellingPrice: String(d.defaultSellingPrice || ""),
        minimumStock: String(d.minimumStock || ""),
        hsn: String(d.hsn || ""),
      })}
      fields={[
        { key: "name", label: "Name" },
        { key: "brand", label: "Brand" },
        { key: "category", label: "Category" },
        { key: "unit", label: "Unit" },
        { key: "defaultPurchasePrice", label: "Purchase price" },
        { key: "defaultSellingPrice", label: "Selling price" },
        { key: "minimumStock", label: "Minimum stock" },
        { key: "hsn", label: "HSN" },
      ]}
    />
  );
}
