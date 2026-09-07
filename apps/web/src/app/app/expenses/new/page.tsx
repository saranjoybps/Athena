"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New expense"
      backHref="/app/expenses"
      backLabel="Expenses"
      successHref="/app/expenses"
      fields={[
        { key: "projectId", label: "Project", type: "relation", required: true, loadOptions: () => optionsFrom(athena.projects.list) },
        { key: "category", label: "Category", required: true, placeholder: "transport / food / tools" },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "paidBy", label: "Paid by", defaultValue: "cash" },
        { key: "description", label: "Description", type: "textarea" },
      ]}
      onSubmit={(form) =>
        athena.expenses.create({
          projectId: form.projectId,
          category: form.category,
          amount: form.amount,
          paidBy: form.paidBy || "cash",
          description: form.description || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
