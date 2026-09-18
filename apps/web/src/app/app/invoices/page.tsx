"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function InvoicesPage() {
  const load = useCallback(() => athena.invoices.list(), []);
  return (
    <DataPage
      title="Invoices"
      subtitle="Create from a project Money tab, or open an existing invoice."
      createHref="/app/projects"
      createLabel="Open projects"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/invoices/${String(item.id)}`}
          title={String(item.number || item.id)}
          subtitle={[
            formatCurrency(String(item.grandTotal || item.total || item.amount || "0")),
            item.dueDate ? `Due ${formatDate(String(item.dueDate))}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          status={item.status ? String(item.status) : undefined}
        />
      )}
    />
  );
}
