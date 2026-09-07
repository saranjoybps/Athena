"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.suppliers.list(), []);
  return (
    <DataPage
      title="Suppliers"
      subtitle="Tap a supplier to edit contact details."
      createHref="/app/suppliers/new"
      createLabel="Add supplier"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/suppliers/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={String(item.phone || item.address || "")}
        />
      )}
    />
  );
}
