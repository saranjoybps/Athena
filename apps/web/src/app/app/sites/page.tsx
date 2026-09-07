"use client";

import { useCallback, useEffect, useState } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
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

  const load = useCallback(() => athena.sites.list(), []);
  return (
    <DataPage
      title="Sites"
      subtitle="Open a site for details, surveys, and measurements."
      createHref="/app/sites/new"
      createLabel="Add site"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/sites/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={[names[String(item.customerId || "")] || null, item.address].filter(Boolean).map(String).join(" · ")}
        />
      )}
    />
  );
}
