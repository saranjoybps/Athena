"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New estimate"
      subtitle="Creates a single-line estimate you can turn into a quote."
      backHref="/app/estimates"
      backLabel="Estimates"
      successHref="/app/estimates"
      fields={[
        { key: "customerId", label: "Customer", type: "relation", required: true, loadOptions: () => optionsFrom(athena.customers.list) },
        { key: "siteId", label: "Site", type: "relation", required: true, loadOptions: () => optionsFrom(athena.sites.list) },
        { key: "title", label: "Title", required: true, placeholder: "Interior painting — Kumar Residence" },
        { key: "description", label: "Line description", required: true, defaultValue: "Painting works" },
        { key: "quantity", label: "Quantity", type: "number", required: true, defaultValue: "1" },
        { key: "unit", label: "Unit", defaultValue: "sqft" },
        { key: "materialCost", label: "Material cost", type: "number", defaultValue: "0" },
        { key: "labourCost", label: "Labour cost", type: "number", defaultValue: "0" },
        { key: "rate", label: "Selling rate (optional)", type: "number" },
        { key: "notes", label: "Assumptions / notes", type: "textarea" },
      ]}
      onSubmit={(form) =>
        athena.estimates.create({
          customerId: form.customerId,
          siteId: form.siteId,
          title: form.title,
          assumptions: form.notes || null,
          items: [
            {
              description: form.description,
              quantity: form.quantity,
              unit: form.unit || "sqft",
              materialCost: form.materialCost || "0",
              labourCost: form.labourCost || "0",
              rate: form.rate || null,
            },
          ],
        }) as Promise<{ id?: string }>
      }
    />
  );
}
