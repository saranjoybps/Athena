"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="Create invoice from quote"
      subtitle="Generates an invoice from an accepted quote."
      backHref="/app/invoices"
      backLabel="Invoices"
      successHref={(r) => (r.id ? `/app/invoices/${r.id}` : "/app/invoices")}
      fields={[
        { key: "quoteId", label: "Accepted quote", type: "relation", required: true, loadOptions: async () => {
          const res = await athena.quotes.list();
          return res.items
            .filter((q) => ["accepted", "invoiced"].includes(String(q.status)))
            .map((q) => ({ value: String(q.id), label: `${q.number || q.id} (${q.status})` }));
        }},
        {
          key: "kind",
          label: "Kind",
          type: "select",
          defaultValue: "final",
          options: [
            { value: "final", label: "Final" },
            { value: "progress", label: "Progress" },
            { value: "milestone", label: "Milestone" },
          ],
        },
        { key: "dueDate", label: "Due date", type: "date" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={async (form) => {
        const doc = (await athena.invoices.fromQuote(
          form.quoteId,
          { kind: form.kind || "final", dueDate: form.dueDate || null, notes: form.notes || null },
          `inv-${form.quoteId}-${Date.now()}`,
        )) as { id?: string };
        return doc;
      }}
    />
  );
}
