"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New schedule entry"
      backHref="/app/schedule"
      backLabel="Schedule"
      successHref="/app/schedule"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "startDate", label: "Start date", type: "date" },
        { key: "endDate", label: "End date", type: "date" },
        { key: "crewId", label: "Crew", type: "relation", loadOptions: () => optionsFrom(athena.crews.list) },
        { key: "progress", label: "Progress %", type: "number", defaultValue: "0" },
      ]}
      onSubmit={(form) =>
        athena.schedules.create({
          projectId: form.projectId,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          crewId: form.crewId || null,
          progress: form.progress || "0",
        }) as Promise<{ id?: string }>
      }
    />
  );
}
