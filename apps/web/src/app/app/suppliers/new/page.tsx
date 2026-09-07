"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New supplier"
      backHref="/app/suppliers"
      backLabel="Suppliers"
      successHref="/app/suppliers"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "company", label: "Company" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "address", label: "Address", type: "textarea" },
        { key: "gstin", label: "GSTIN" },
        { key: "paymentTerms", label: "Payment terms" },
      ]}
      onSubmit={(form) =>
        athena.suppliers.create({
          name: form.name,
          company: form.company || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          gstin: form.gstin || null,
          paymentTerms: form.paymentTerms || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
