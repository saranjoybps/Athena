"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.expenses.list(), []);
  return (
    <DataPage
      title="Expenses"
      subtitle="Tap an expense to edit amount or category."
      createHref="/app/expenses/new"
      createLabel="Add expense"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/expenses/${String(item.id)}`}
          title={String(item.category || item.id)}
          subtitle={`₹${item.amount || "0"} · ${item.description || ""}`}
        />
      )}
    />
  );
}
