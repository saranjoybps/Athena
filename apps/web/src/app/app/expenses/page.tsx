"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function ExpensesPage() {
  const load = useCallback(() => athena.expenses.list(), []);
  return (
    <DataPage
      title="Expenses"
      subtitle="Site and project spend. Add from a project Money tab or Field."
      createHref="/app/expenses/new"
      createLabel="New expense"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/expenses/${String(item.id)}`}
          title={String(item.category || item.description || item.id)}
          subtitle={[
            formatCurrency(String(item.amount || "0")),
            item.createdAt ? formatDate(String(item.createdAt)) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          status={item.billableToCustomer ? "billable" : undefined}
        />
      )}
    />
  );
}
