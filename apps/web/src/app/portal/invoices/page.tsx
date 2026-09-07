"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";

export default function PortalInvoicesPage() {
  const load = useCallback(() => athena.portal.invoices(), []);
  return (
    <DataPage
      title="Your invoices"
      subtitle="Amounts due and payment history."
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl border p-4">
          <p className="font-medium">{String(item.number)}</p>
          <p className="text-sm text-stone-600">₹{String(item.outstanding || item.total)} outstanding</p>
        </div>
      )}
    />
  );
}
