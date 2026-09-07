"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.crews.list(), []);
  return (
    <DataPage
      title="Crews"
      subtitle="Site crews — tap to edit."
      createHref="/app/crews/new"
      createLabel="Add crew"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/crews/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={String(item.trade || item.dailyCost || '')}
        />
      )}
    />
  );
}
