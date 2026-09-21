"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New estimate"
      subtitle="Create an estimate document from an approved costed scope."
      backHref="/app/quotes"
      backLabel="Estimates"
      documentChrome
      successHref={(r) => (r.id ? `/app/quotes/${r.id}` : "/app/quotes")}
      fields={[
        { key: "estimateId", label: "Estimate", type: "relation", required: true, loadOptions: () => optionsFrom(athena.estimates.list, ["title", "number", "id"]) },
        { key: "validityDays", label: "Validity (days)", type: "number", defaultValue: "15" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={async (form) => {
        const doc = (await athena.quotes.create({
          estimateId: form.estimateId,
          validityDays: Number(form.validityDays || 15),
          notes: form.notes || null,
        })) as { id?: string };
        return doc;
      }}
    />
  );
}
