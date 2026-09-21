"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

function labourIdsFromCrew(members: unknown): string[] {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => {
      if (!m || typeof m !== "object") return "";
      const row = m as Record<string, unknown>;
      return String(row.labourId || row.workerId || "");
    })
    .filter(Boolean);
}

export default function Page() {
  return (
    <RecordFormPage
      title="Mark attendance"
      backHref="/app/attendance"
      backLabel="Attendance"
      successHref="/app/attendance"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "crewId", label: "Crew", type: "relation", loadOptions: () => optionsFrom(athena.crews.list) },
        {
          key: "workerId",
          label: "Worker",
          type: "relation",
          dependsOn: ["crewId"],
          loadOptions: async (form) => {
            const all = await optionsFrom(athena.labour.list);
            const crewId = String(form.crewId || "").trim();
            if (!crewId) return all;
            const crew = await athena.crews.get(crewId);
            const allowed = new Set(labourIdsFromCrew(crew.members));
            if (!allowed.size) return [];
            return all.filter((o) => allowed.has(o.value));
          },
        },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          defaultValue: "present",
          options: [
            { value: "present", label: "Present" },
            { value: "half_day", label: "Half day" },
            { value: "absent", label: "Absent" },
            { value: "overtime", label: "Overtime" },
            { value: "leave", label: "Leave" },
          ],
        },
        { key: "overtimeHours", label: "Overtime hours", type: "number", defaultValue: "0" },
      ]}
      onSubmit={(form) =>
        athena.attendance.create({
          projectId: form.projectId,
          crewId: form.crewId || null,
          workerId: form.workerId || null,
          date: form.date || null,
          status: form.status,
          overtimeHours: form.overtimeHours || "0",
        }) as Promise<{ id?: string }>
      }
    />
  );
}
