"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.materials.list(), []);
  return (
    <DataPage
      title="Materials"
      subtitle="Tap a material to edit prices and stock levels."
      createHref="/app/materials/new"
      createLabel="Add material"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/materials/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={String(item.brand || item.category || item.unit || "")}
        />
      )}
    />
  );
}
