"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataPage } from "@/components/data-page";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    athena.customers
      .list()
      .then((r) => {
        const map: Record<string, string> = {};
        for (const c of r.items) map[String(c.id)] = String(c.name || c.id);
        setNames(map);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => athena.payments.list(), []);
  return (
    <DataPage
      title="Payments"
      subtitle="Collections against invoices. Record payment from an invoice, project money, or Accounts receivables."
      createHref="/app/payments/new?from=payments"
      createLabel="Record payment"
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">
            {formatCurrency(String(item.amount || "0"))} · {String(item.method || "")}
          </p>
          <p className="text-sm text-stone-600">
            {item.customerId ? (
              <Link href={`/app/customers/${String(item.customerId)}`} className="text-clay">
                {names[String(item.customerId)] || "Customer"}
              </Link>
            ) : (
              "Payment"
            )}
            {item.invoiceId ? (
              <>
                {" · "}
                <Link href={`/app/invoices/${String(item.invoiceId)}`} className="text-clay">
                  Invoice
                </Link>
              </>
            ) : null}
            {" · "}
            {formatDate(String(item.createdAt || ""))}
          </p>
        </div>
      )}
    />
  );
}
