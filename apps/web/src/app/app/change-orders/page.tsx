"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.changeOrders.list(), []);
  return (
    <DataPage
      title="Change orders"
      subtitle="Scope and price changes."
      createHref="/app/change-orders/new"
      createLabel="Add change order"
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">{String(item.reason || item.id)}</p>
          <p className="text-sm text-stone-600">{String(`Cost ${item.additionalCost || 0} · Sell ${item.sellingPrice || 0} · ${item.status || ''}`)}</p>
        </div>
      )}
    />
  );
}
