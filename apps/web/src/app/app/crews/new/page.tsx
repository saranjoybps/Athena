"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New crew"
      subtitle="Name the crew. Optionally add a labour member so attendance can be marked."
      backHref="/app/crews"
      backLabel="Crews"
      successHref="/app/crews"
      fields={[
        { key: "name", label: "Crew name", required: true },
        {
          key: "memberId",
          label: "Add member (optional)",
          type: "relation",
          loadOptions: () => optionsFrom(athena.labour.list),
        },
      ]}
      onSubmit={(form) =>
        athena.crews.create({
          name: form.name,
          members: form.memberId ? [{ workerId: form.memberId }] : [],
        }) as Promise<{ id?: string }>
      }
    />
  );
}
