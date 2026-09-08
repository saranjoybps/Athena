"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";
import { expenseBackHref } from "@/lib/money-nav";

function ExpenseDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const queryProjectId = search.get("projectId") || "";
  const from = search.get("from") || "";
  const [projectId, setProjectId] = useState(queryProjectId);

  const load = useCallback(() => athena.expenses.get(id), [id]);

  useEffect(() => {
    if (queryProjectId) return;
    athena.expenses
      .get(id)
      .then((d) => {
        if (d.projectId) setProjectId(String(d.projectId));
      })
      .catch(() => undefined);
  }, [id, queryProjectId]);

  const backHref = expenseBackHref({
    projectId: projectId || queryProjectId || null,
    from: from || null,
  });

  return (
    <EditableDetailPage
      title="Edit expense"
      backHref={backHref}
      backLabel={from === "accounts" ? "Accounts" : projectId || queryProjectId ? "Project money" : "Projects"}
      successHref={backHref}
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

export default function ExpenseDetailPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <ExpenseDetailInner />
    </Suspense>
  );
}
