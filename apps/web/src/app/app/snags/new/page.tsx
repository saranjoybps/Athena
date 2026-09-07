"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New snag"
      backHref="/app/snags"
      backLabel="Snags"
      successHref="/app/snags"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "description", label: "Description", type: "textarea", required: true },
        { key: "location", label: "Location" },
        { key: "dueDate", label: "Due date", type: "date" },
      ]}
      onSubmit={(form) =>
        athena.snags.create({
          projectId: form.projectId,
          description: form.description,
          location: form.location || null,
          dueDate: form.dueDate || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
