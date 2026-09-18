"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatQty } from "@/lib/name-maps";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(async () => {
    const res = await athena.stock.summary();
    return { items: res.items || [] };
  }, []);

  return (
    <DataPage
      title="Stock"
      subtitle="On-hand quantities for tools and materials."
      createHref="/app/inventory/new"
      createLabel="Add tool"
      load={load}
      render={(item) => {
        const name = String(item.toolName || item.materialName || item.name || "Item");
        const low = Boolean(item.lowStock);
        return (
          <RecordLink
            key={String(item.id)}
            href={item.materialId ? `/app/materials/${String(item.materialId)}` : `/app/inventory/${String(item.id)}`}
            title={name}
            subtitle={[
              `Qty ${formatQty(item.onHand ?? item.qty)}`,
              String(item.warehouse || "main"),
              item.unit ? String(item.unit) : null,
              low ? "Low stock" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            status={low ? "low" : undefined}
          />
        );
      }}
    />
  );
}
