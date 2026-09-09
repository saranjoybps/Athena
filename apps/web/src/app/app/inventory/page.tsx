"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatQty } from "@/lib/name-maps";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.inventory.list(), []);
  return (
    <DataPage
      title="Tools"
      subtitle="Site tools and equipment — tap to edit."
      createHref="/app/inventory/new"
      createLabel="Add tool"
      load={load}
      render={(item) => {
        const name = String(item.name || item.materialName || "Tool");
        return (
          <RecordLink
            key={String(item.id)}
            href={`/app/inventory/${String(item.id)}`}
            title={name}
            subtitle={`Qty ${formatQty(item.qty)} · ${String(item.warehouse || "main")}`}
          />
        );
      }}
    />
  );
}
