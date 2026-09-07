"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="Add photo"
      backHref="/app/photos"
      backLabel="Photos"
      successHref="/app/photos"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "url", label: "Image URL", required: true, placeholder: "https://..." },
        { key: "category", label: "Category", placeholder: "before / after / progress" },
        { key: "description", label: "Description", type: "textarea" },
      ]}
      onSubmit={(form) =>
        athena.photos.create({
          projectId: form.projectId,
          url: form.url,
          category: form.category || null,
          description: form.description || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
