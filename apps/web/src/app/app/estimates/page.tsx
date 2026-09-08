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

  const load = useCallback(() => athena.estimates.list(), []);
  return (
    <DataPage
      title="Estimates"
      subtitle="Build costed scopes, then convert to quotes."
      createHref="/app/estimates/new"
      createLabel="Add estimate"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/estimates/${String(item.id)}${item.customerId ? `?customerId=${String(item.customerId)}` : ""}`}
          title={String(item.title || item.number || item.id)}
          subtitle={[
            names[String(item.customerId || "")] || null,
            formatCurrency(String((item.computed as Record<string, string> | undefined)?.grandTotal || item.total || "0")),
          ]
            .filter(Boolean)
            .join(" · ")}
          status={item.status ? String(item.status) : undefined}
        />
      )}
    />
  );
}
