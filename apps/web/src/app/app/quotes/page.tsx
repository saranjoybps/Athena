"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { fabrica } from "@/lib/fabrica-client";

export default function QuotesPage() {
  const load = useCallback(() => fabrica.quotes.list(), []);
  return (
    <DataPage
      title="Quotations"
      subtitle="Send and track customer approvals."
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm flex justify-between items-center">
          <div>
            <p className="font-medium">{String(item.number)}</p>
            <p className="text-sm text-stone-600">{String(item.status)}</p>
          </div>
          {item.status === "sent" ? (
            <button
              className="text-sm text-clay"
              onClick={() => fabrica.quotes.accept(String(item.id)).then(() => window.location.reload())}
              type="button"
            >
              Accept
            </button>
          ) : null}
        </div>
      )}
    />
  );
}
