"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { fabrica } from "@/lib/fabrica-client";

export default function Page() {
  const load = useCallback(() => fabrica.materials.list(), []);
  return (
    <DataPage
      title="Materials"
      subtitle="Material master"
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">{String(item.name || item.number || item.title || item.id)}</p>
          <p className="text-sm text-stone-600">{String(item.status || item.phone || item.address || "")}</p>
        </div>
      )}
    />
  );
}
