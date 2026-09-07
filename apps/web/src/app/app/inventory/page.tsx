"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatQty, useNameMaps } from "@/lib/name-maps";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { materials } = useNameMaps();
  const load = useCallback(() => athena.inventory.list(), []);
  return (
    <DataPage
      title="Inventory"
      subtitle="Stock levels — tap to edit."
      createHref="/app/inventory/new"
      createLabel="Add stock"
      load={load}
      render={(item) => {
        const materialId = String(item.materialId || "");
        const name = materials[materialId] || "Material";
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
