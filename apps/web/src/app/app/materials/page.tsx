"use client";

import { useCallback, useEffect, useState } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";
import { formatQty } from "@/lib/name-maps";

export default function Page() {
  const [stockByMaterial, setStockByMaterial] = useState<Record<string, { qty: string; low?: boolean }>>({});

  useEffect(() => {
    athena.stock
      .summary()
      .then((res) => {
        const map: Record<string, { qty: string; low?: boolean }> = {};
        for (const row of res.items || []) {
          const mid = String(row.materialId || "");
          if (!mid) continue;
          const prev = map[mid];
          const qty = Number(prev?.qty || 0) + Number(row.onHand || row.qty || 0);
          map[mid] = { qty: String(qty), low: Boolean(row.lowStock) || prev?.low };
        }
        setStockByMaterial(map);
      })
      .catch(() => setStockByMaterial({}));
  }, []);

  const load = useCallback(() => athena.materials.list(), []);

  return (
    <DataPage
      title="Materials"
      subtitle="Catalog with on-hand qty from stock ledger."
      createHref="/app/materials/new"
      createLabel="Add material"
      load={load}
      render={(item) => {
        const id = String(item.id);
        const stock = stockByMaterial[id];
        const qtyLabel = stock ? `On hand ${formatQty(stock.qty)}` : "No stock row";
        return (
          <RecordLink
            key={id}
            href={`/app/materials/${id}`}
            title={String(item.name || item.id)}
            subtitle={[String(item.brand || item.category || item.unit || ""), qtyLabel, stock?.low ? "Low stock" : null]
              .filter(Boolean)
              .join(" · ")}
            status={stock?.low ? "low" : undefined}
          />
        );
      }}
    />
  );
}
