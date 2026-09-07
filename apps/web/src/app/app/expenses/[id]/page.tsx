"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.expenses.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit expense"
      backHref="/app/expenses"
      backLabel="Expenses"
      load={load}
      save={(form) =>
        athena.expenses.update(id, {
          category: form.category,
          amount: form.amount,
          paidBy: form.paidBy || "cash",
          description: form.description || null,
        })
      }
      mapToForm={(d) => ({
        category: String(d.category || ""),
        amount: String(d.amount || ""),
        paidBy: String(d.paidBy || "cash"),
        description: String(d.description || ""),
      })}
      fields={[
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount" },
        { key: "paidBy", label: "Paid by" },
        { key: "description", label: "Description", multiline: true },
      ]}
    />
  );
}
