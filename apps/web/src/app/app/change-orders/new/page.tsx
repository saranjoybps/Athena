"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New change order"
      backHref="/app/change-orders"
      backLabel="Change orders"
      successHref="/app/change-orders"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "reason", label: "Reason", required: true },
        { key: "additionalScope", label: "Additional scope", type: "textarea" },
        { key: "additionalCost", label: "Additional cost", type: "number", required: true },
        { key: "sellingPrice", label: "Selling price", type: "number", required: true },
      ]}
      onSubmit={(form) =>
        athena.changeOrders.create({
          projectId: form.projectId,
          reason: form.reason,
          additionalScope: form.additionalScope || null,
          additionalCost: form.additionalCost,
          sellingPrice: form.sellingPrice,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
