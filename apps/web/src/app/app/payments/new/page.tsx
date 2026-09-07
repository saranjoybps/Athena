"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  const search = useSearchParams();
  const invoiceId = search.get("invoiceId") || "";

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
        title="Record payment"
        backHref="/app/payments"
        backLabel="Payments"
        successHref="/app/payments"
        fields={[
          {
            key: "invoiceId",
            label: "Invoice",
            type: "relation",
            required: true,
            defaultValue: invoiceId,
            loadOptions: () => optionsFrom(athena.invoices.list, ["number", "id"]),
          },
          { key: "amount", label: "Amount", type: "number", required: true },
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
        onSubmit={(form) =>
          athena.payments.create(
            {
              invoiceId: form.invoiceId,
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
