"use client";

import { useCallback, useEffect, useState } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatCurrency } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function QuotesPage() {
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

  const load = useCallback(() => athena.quotes.list(), []);
  return (
    <DataPage
      title="Quotations"
      subtitle="Create from estimate, then send / accept / invoice."
      createHref="/app/quotes/new"
      createLabel="New quote"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/quotes/${String(item.id)}`}
          title={String(item.number || item.id)}
          subtitle={[
            names[String(item.customerId || "")] || null,
            formatCurrency(String((item.computed as Record<string, string> | undefined)?.grandTotal || "0")),
          ]
            .filter(Boolean)
            .join(" · ")}
          status={item.status ? String(item.status) : undefined}
        />
      )}
    />
  );
}
