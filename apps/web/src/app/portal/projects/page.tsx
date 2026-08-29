"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { fabrica } from "@/lib/fabrica-client";

export default function PortalProjectsPage() {
  const load = useCallback(() => fabrica.portal.projects(), []);
  return (
    <DataPage
      title="Your projects"
      subtitle="Progress and scope only — no internal costs."
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl border p-4">
          <p className="font-medium">{String(item.name)}</p>
          <p className="text-sm text-stone-600">{String(item.number)} · {String(item.status)}</p>
        </div>
      )}
    />
  );
}
