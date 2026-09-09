"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";
import { projectHref } from "@/lib/money-nav";

function NewExpenseForm() {
  const search = useSearchParams();
  const projectId = search.get("projectId") || "";
  const backHref = projectId ? projectHref(projectId, "money") : "/app/projects";

  return (
    <RecordFormPage
      title="New expense"
      subtitle={projectId ? "Logged against the current project." : "Choose a project and log the expense."}
      backHref={backHref}
      backLabel={projectId ? "Project money" : "Projects"}
      successHref={backHref}
      fields={[
        {
          key: "projectId",
          label: "Project",
          type: "relation",
          required: true,
          defaultValue: projectId,
          hidden: Boolean(projectId),
          loadOptions: () => optionsFrom(athena.projects.list),
        },
        { key: "category", label: "Category", required: true, placeholder: "transport / food / tools" },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "paidBy", label: "Paid by", defaultValue: "cash" },
        { key: "description", label: "Description", type: "textarea" },
        {
          key: "billableToCustomer",
          label: "Billable to customer",
          type: "checkbox",
          defaultValue: "no",
          placeholder: "Include on customer invoice",
        },
      ]}
      onSubmit={(form) =>
        athena.expenses.create({
          projectId: form.projectId || projectId,
          category: form.category,
          amount: form.amount,
          paidBy: form.paidBy || "cash",
          description: form.description || null,
          billableToCustomer: form.billableToCustomer === "yes" || form.billableToCustomer === "true",
        }) as Promise<{ id?: string }>
      }
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <NewExpenseForm />
    </Suspense>
  );
}
