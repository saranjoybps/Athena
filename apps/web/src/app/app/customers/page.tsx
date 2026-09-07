"use client";

import Link from "next/link";
import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";

export default function CustomersPage() {
  const load = useCallback(() => athena.customers.list(), []);
  return (
    <DataPage
      title="Customers"
      subtitle="Open a customer for CRM — sites, quotes, projects, money, and follow-ups."
      createHref="/app/customers/new"
      createLabel="Add customer"
      load={load}
      render={(item) => (
        <Link
          key={String(item.id)}
          href={`/app/customers/${String(item.id)}`}
          className="rounded-2xl bg-white p-4 shadow-sm block hover:ring-2 hover:ring-clay/20"
        >
          <p className="font-medium">{String(item.name)}</p>
          <p className="text-sm text-stone-600">{String(item.phone || item.email || "")}</p>
          <p className="mt-1 text-xs text-clay">Open CRM →</p>
        </Link>
      )}
    />
  );
}
