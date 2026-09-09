"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New document"
      backHref="/app/documents"
      backLabel="Documents"
      successHref="/app/documents"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "url", label: "URL (Cloudinary or link)", required: true, placeholder: "https://..." },
        { key: "category", label: "Category", defaultValue: "other" },
        { key: "siteId", label: "Site", type: "relation", loadOptions: () => optionsFrom(athena.sites.list) },
        { key: "projectId", label: "Project", type: "relation", loadOptions: () => optionsFrom(athena.projects.list) },
      ]}
      onSubmit={(form) =>
        athena.documents.create({
          name: form.name,
          url: form.url,
          category: form.category || "other",
          siteId: form.siteId || null,
          projectId: form.projectId || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
