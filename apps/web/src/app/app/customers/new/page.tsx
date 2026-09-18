"use client";

import { RecordFormPage } from "@/components/record-form";
import { QuotaGuard } from "@/components/quota-guard";
import { athena } from "@/lib/athena-client";

export default function NewCustomerPage() {
  return (
    <QuotaGuard metric="customers">
    <RecordFormPage
      title="New customer"
      subtitle="Customers hold sites, surveys, measurements, and estimates."
      backHref="/app/customers"
      backLabel="Customers"
      successHref="/app/customers"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "email", label: "Email" },
        { key: "company", label: "Company (optional)" },
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
    </QuotaGuard>
  );
}
