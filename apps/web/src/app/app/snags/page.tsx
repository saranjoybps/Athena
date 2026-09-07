"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.snags.list(), []);
  return (
    <DataPage
      title="Snags"
      subtitle="Defects and punch list."
      createHref="/app/snags/new"
      createLabel="Add snag"
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">{String(item.description || item.id)}</p>
          <p className="text-sm text-stone-600">{String(`${item.location || ''} · ${item.status || ''}`)}</p>
        </div>
      )}
    />
  );
}
