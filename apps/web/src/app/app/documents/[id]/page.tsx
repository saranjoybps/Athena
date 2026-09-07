"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.documents.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit document"
      backHref="/app/documents"
      backLabel="Documents"
      load={load}
      save={(form) =>
        athena.documents.update(id, {
          name: form.name,
          url: form.url,
          category: form.category || null,
          projectId: form.projectId || null,
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || ""),
        url: String(d.url || ""),
        category: String(d.category || ""),
        projectId: String(d.projectId || ""),
      })}
      fields={[
        { key: "name", label: "Name" },
        { key: "url", label: "URL" },
        { key: "category", label: "Category" },
        { key: "projectId", label: "Project id" },
      ]}
    />
  );
}
