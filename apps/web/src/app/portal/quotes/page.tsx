"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { fabrica } from "@/lib/fabrica-client";

export default function PortalQuotesPage() {
  const load = useCallback(() => fabrica.portal.quotes(), []);
  return (
    <DataPage
      title="Your quotes"
      subtitle="Review and approve quotations."
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl border p-4">
          <p className="font-medium">{String(item.number)}</p>
          <p className="text-sm text-stone-600">{String(item.status)}</p>
        </div>
      )}
    />
  );
}
