"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="Start project from quote"
      subtitle="Only accepted quotes can become projects."
      backHref="/app/projects"
      backLabel="Projects"
      successHref={(r) => (r.id ? `/app/projects/${r.id}` : "/app/projects")}
      fields={[
        { key: "quoteId", label: "Accepted quote", type: "relation", required: true, loadOptions: async () => {
          const res = await athena.quotes.list();
          return res.items
            .filter((q) => String(q.status) === "accepted")
            .map((q) => ({ value: String(q.id), label: String(q.number || q.id) }));
        }},
        { key: "name", label: "Project name (optional)" },
        { key: "startDate", label: "Start date", type: "date" },
        { key: "expectedCompletion", label: "Expected completion", type: "date" },
      ]}
      onSubmit={async (form) => {
        const doc = (await athena.projects.fromQuote({
          quoteId: form.quoteId,
          name: form.name || null,
          startDate: form.startDate || null,
          expectedCompletion: form.expectedCompletion || null,
        })) as { id?: string };
        return doc;
      }}
    />
  );
}
