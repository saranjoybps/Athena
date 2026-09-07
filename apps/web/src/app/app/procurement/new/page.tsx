"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New material request"
      backHref="/app/procurement"
      backLabel="Procurement"
      successHref="/app/procurement"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "materialId", label: "Material", type: "relation", required: true, loadOptions: () => optionsFrom(athena.materials.list) },
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={(form) =>
        athena.materialRequests.create({
          projectId: form.projectId,
          materialId: form.materialId,
          qty: form.qty,
          notes: form.notes || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
