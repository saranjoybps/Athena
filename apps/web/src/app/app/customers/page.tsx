"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { fabrica } from "@/lib/fabrica-client";

export default function CustomersPage() {
  const load = useCallback(() => fabrica.customers.list(), []);
  return (
    <DataPage
      title="Customers"
      subtitle="Operational directory for jobs, quotes, and invoices."
      createHref="/app/customers/new"
      createLabel="Add customer"
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">{String(item.name)}</p>
          <p className="text-sm text-stone-600">{String(item.phone || item.email || "")}</p>
        </div>
      )}
    />
  );
}
