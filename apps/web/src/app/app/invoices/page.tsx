"use client";

import Link from "next/link";
import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { formatCurrency } from "@/lib/format";
import { fabrica } from "@/lib/fabrica-client";

export default function Page() {
  const load = useCallback(() => fabrica.invoices.list(), []);
  return (
    <DataPage
      title="Invoices"
      subtitle="Progress, final, and tax invoices with PDF generation."
      load={load}
      render={(item) => (
        <Link
          key={String(item.id)}
          href={`/app/invoices/${String(item.id)}`}
          className="rounded-2xl bg-white p-4 shadow-sm flex justify-between items-center hover:ring-2 hover:ring-clay/20"
        >
          <div>
            <p className="font-medium">{String(item.number || item.id)}</p>
            <p className="text-sm text-stone-600">{String(item.status || "")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-stone-800">{formatCurrency(String(item.total || "0"))}</p>
            <p className="text-xs text-stone-500">View & PDF</p>
          </div>
        </Link>
      )}
    />
  );
}
