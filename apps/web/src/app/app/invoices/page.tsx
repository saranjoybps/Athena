"use client";

import { useCallback, useEffect, useState } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatCurrency } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    athena.customers
      .list()
      .then((r) => {
        const map: Record<string, string> = {};
        for (const c of r.items) map[String(c.id)] = String(c.name || c.id);
        setNames(map);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => athena.invoices.list(), []);
  return (
    <DataPage
      title="Invoices"
      subtitle="Create from quote, edit notes, mark sent, collect payment."
      createHref="/app/invoices/new"
      createLabel="From quote"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/invoices/${String(item.id)}`}
          title={String(item.number || item.id)}
          subtitle={[
            names[String(item.customerId || "")] || null,
            formatCurrency(String(item.total_amount || item.total || "0")),
            item.outstanding ? `due ${formatCurrency(String(item.outstanding))}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          status={item.status ? String(item.status) : undefined}
        />
      )}
    />
  );
}
