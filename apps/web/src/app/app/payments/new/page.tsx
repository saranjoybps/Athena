"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";
import { paymentBackHref } from "@/lib/money-nav";

function PaymentForm() {
  const search = useSearchParams();
  const invoiceId = search.get("invoiceId") || "";
  const projectId = search.get("projectId") || "";
  const from = search.get("from") || "";
  const presetAmount = search.get("amount") || "";
  const [amount, setAmount] = useState(presetAmount);
  const [resolvedProjectId, setResolvedProjectId] = useState(projectId);

  useEffect(() => {
    if (!invoiceId) return;
    athena.invoices
      .get(invoiceId)
      .then((inv) => {
        if (!presetAmount) setAmount(String(inv.outstanding || inv.total || inv.total_amount || ""));
        if (!projectId && inv.projectId) setResolvedProjectId(String(inv.projectId));
      })
      .catch(() => undefined);
  }, [invoiceId, presetAmount, projectId]);

  const backHref = paymentBackHref({
    invoiceId: invoiceId || null,
    projectId: resolvedProjectId || projectId || null,
    from: from || (invoiceId ? "invoice" : null),
  });

  const backLabel =
    from === "accounts"
      ? "Accounts"
      : invoiceId
        ? "Invoice"
        : resolvedProjectId || projectId
          ? "Project money"
          : "Payments";

  return (
    <div>
      {invoiceId ? (
        <p className="mb-4 text-sm text-stone-600">
          Paying invoice{" "}
          <Link href={`/app/invoices/${invoiceId}`} className="text-clay">
            {invoiceId.slice(0, 8)}…
          </Link>
        </p>
      ) : null}
      <RecordFormPage
        key={`${invoiceId}-${amount}-${backHref}`}
        title="Record payment"
        backHref={backHref}
        backLabel={backLabel}
        successHref={backHref}
        fields={[
          {
            key: "invoiceId",
            label: "Project Invoice",
            type: "relation",
            required: true,
            defaultValue: invoiceId,
            readOnly: Boolean(invoiceId),
            hidden: Boolean(invoiceId),
            loadOptions: () => optionsFrom(athena.invoices.list, ["number", "id"]),
          },
          { key: "amount", label: "Amount", type: "number", required: true, defaultValue: amount },
          {
            key: "method",
            label: "Method",
            type: "select",
            required: true,
            defaultValue: "upi",
            options: [
              { value: "upi", label: "UPI" },
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank transfer" },
              { value: "cheque", label: "Cheque" },
              { value: "card", label: "Card" },
            ],
          },
          { key: "reference", label: "Reference" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        infoPanel={
          invoiceId ? (
            <div className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Invoice</p>
              <p className="mt-1 font-medium text-stone-900">Selected invoice is locked for this payment.</p>
            </div>
          ) : null
        }
        onSubmit={(form) =>
          athena.payments.create(
            {
              invoiceId: form.invoiceId || invoiceId,
              amount: form.amount,
              method: form.method,
              reference: form.reference || null,
              notes: form.notes || null,
            },
            `pay-${Date.now()}`,
          ) as Promise<{ id?: string }>
        }
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <PaymentForm />
    </Suspense>
  );
}
