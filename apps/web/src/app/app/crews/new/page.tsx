"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New crew"
      backHref="/app/crews"
      backLabel="Crews"
      successHref="/app/crews"
      fields={[
        { key: "name", label: "Crew name", required: true },
        { key: "trade", label: "Trade" },
        { key: "dailyCost", label: "Daily cost" },
        { key: "expectedProductivity", label: "Expected productivity" },
      ]}
      onSubmit={(form) =>
        athena.crews.create({
          name: form.name,
          trade: form.trade || null,
          dailyCost: form.dailyCost || null,
          expectedProductivity: form.expectedProductivity || null,
          members: [],
        }) as Promise<{ id?: string }>
      }
    />
  );
}
