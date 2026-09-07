"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.suppliers.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit supplier"
      backHref="/app/suppliers"
      backLabel="Suppliers"
      load={load}
      save={(form) =>
        athena.suppliers.update(id, {
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          gstin: form.gstin || null,
          paymentTerms: form.paymentTerms || null,
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || ""),
        phone: String(d.phone || ""),
        email: String(d.email || ""),
        address: String(d.address || ""),
        gstin: String(d.gstin || ""),
        paymentTerms: String(d.paymentTerms || ""),
      })}
      fields={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "gstin", label: "GSTIN" },
        { key: "paymentTerms", label: "Payment terms" },
        { key: "address", label: "Address", multiline: true },
      ]}
    />
  );
}
