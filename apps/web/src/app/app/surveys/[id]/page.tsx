"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.surveys.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit survey"
      backHref="/app/surveys"
      backLabel="Surveys"
      load={load}
      save={async (form) => {
        const current = await athena.surveys.get(id);
        await athena.surveys.update(id, {
          customerId: current.customerId,
          siteId: current.siteId,
          projectType: form.projectType || "painting",
          date: form.date || null,
          scope: form.scope || null,
          clientRequirements: form.clientRequirements || null,
          existingConditions: form.existingConditions || null,
          exclusions: form.exclusions || null,
          assumptions: form.assumptions || null,
          notes: form.notes || null,
        });
      }}
      mapToForm={(d) => ({
        projectType: String(d.projectType || "painting"),
        date: String(d.date || "").slice(0, 10),
        scope: String(d.scope || ""),
        clientRequirements: String(d.clientRequirements || ""),
        existingConditions: String(d.existingConditions || ""),
        exclusions: String(d.exclusions || ""),
        assumptions: String(d.assumptions || ""),
        notes: String(d.notes || ""),
      })}
      fields={[
        { key: "projectType", label: "Project type" },
        { key: "date", label: "Date", type: "date" },
        { key: "scope", label: "Scope", multiline: true },
        { key: "clientRequirements", label: "Client requirements", multiline: true },
        { key: "existingConditions", label: "Existing conditions", multiline: true },
        { key: "exclusions", label: "Exclusions", multiline: true },
        { key: "assumptions", label: "Assumptions", multiline: true },
        { key: "notes", label: "Notes", multiline: true },
      ]}
      subtitle={(d) => String(d.number || "")}
    />
  );
}
