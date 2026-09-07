"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function NewCustomerPage() {
  return (
    <RecordFormPage
      title="New customer"
      subtitle="Customers support projects, quotes, and invoices."
      backHref="/app/customers"
      backLabel="Customers"
      successHref="/app/customers"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "email", label: "Email" },
        { key: "company", label: "Company" },
        { key: "gstin", label: "GSTIN" },
        { key: "address", label: "Address", type: "textarea" },
        { key: "billingAddress", label: "Billing address", type: "textarea" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={(form) =>
        athena.customers.create({
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          company: form.company || null,
          gstin: form.gstin || null,
          address: form.address || null,
          billingAddress: form.billingAddress || null,
          notes: form.notes || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
