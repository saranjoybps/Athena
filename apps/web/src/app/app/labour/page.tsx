"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.labour.list(), []);
  return (
    <DataPage
      title="Labour"
      subtitle="Tap a worker to edit rates and trade."
      createHref="/app/labour/new"
      createLabel="Add worker"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/labour/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={`${item.trade || ""} · ${item.phone || item.dailyRate || ""}`}
        />
      )}
    />
  );
}
