"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

type InvoiceLine = {
  description: string;
  amount: string;
  quantity?: string;
  unit?: string;
  rate?: string;
};

function amountFromRawLine(line: Record<string, unknown>): number {
  const qty = Number(line.quantity || 0);
  const rate = Number(line.rate || 0);
  const material = Number(line.materialCost || 0);
  const labour = Number(line.labourCost || 0);
  const equipment = Number(line.equipmentCost || 0);
  const other = Number(line.otherCost || 0);
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(qty) && qty > 0) return qty * rate;
  return material + labour + equipment + other;
}

function linesFromQuote(quote: Record<string, unknown>): InvoiceLine[] {
  const normalized = (quote.line_items as Array<Record<string, unknown>>) || [];
  if (normalized.length) {
    return normalized.map((line) => ({
      description: String(line.description || "Estimate line"),
      amount: String(line.subtotal || line.total || "0"),
      quantity: String(line.quantity || "1"),
      unit: String(line.unit || ""),
      rate: String(line.unit_price || ""),
    }));
  }

  const raw = (quote.items as Array<Record<string, unknown>>) || [];
  return raw
    .map((line) => {
      const amount = amountFromRawLine(line);
      const qty = Number(line.quantity || 1) || 1;
      const rate = Number(line.rate || 0) > 0 ? Number(line.rate) : amount / qty;
      return {
        description: String(line.description || "Estimate line"),
        amount: String(Number.isFinite(amount) ? amount : 0),
        quantity: String(qty),
        unit: String(line.unit || ""),
        rate: String(Number.isFinite(rate) ? rate : 0),
      };
    })
    .filter((line) => Number(line.amount) > 0 || line.description);
}

function CreateInvoiceForm() {
  const search = useSearchParams();
  const projectId = search.get("projectId") || "";
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<InvoiceLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setError("Open Create Invoice from a project.");
      setReady(true);
      return;
    }
    Promise.all([athena.projects.get(projectId), athena.quotes.list(), athena.expenses.list(projectId)])
      .then(async ([project, quotes, expenses]) => {
        const quoteId = String(project.quoteId || "");
        let items: InvoiceLine[] = [];

        if (quoteId) {
          const quote = await athena.quotes.get(quoteId);
          items = linesFromQuote(quote);

          if (!items.length && quote.estimateId) {
            const estimate = await athena.estimates.get(String(quote.estimateId)).catch(() => null);
            if (estimate) items = linesFromQuote(estimate);
          }

          if (!items.length) {
            const computed = (quote.computed as Record<string, unknown>) || {};
            items = [
              {
                description: String(quote.number || "Approved estimate"),
                amount: String(computed.grandTotal || computed.selling || project.contractValue || "0"),
                quantity: "1",
                unit: "",
                rate: String(computed.grandTotal || computed.selling || project.contractValue || "0"),
              },
            ];
          }
        } else {
          items = [
            {
              description: String(project.name || "Project work"),
              amount: String(project.contractValue || "0"),
              quantity: "1",
              unit: "",
              rate: String(project.contractValue || "0"),
            },
          ];
        }

        const billable = expenses.items.filter((e) => e.billableToCustomer === true);
        for (const exp of billable) {
          items.push({
            description: `Expense: ${String(exp.category || "other")}${exp.description ? ` — ${exp.description}` : ""}`,
            amount: String(exp.amount || "0"),
            quantity: "1",
            unit: "",
            rate: String(exp.amount || "0"),
          });
        }
        setPreview(items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to prepare invoice"))
      .finally(() => setReady(true));
  }, [projectId]);

  if (!ready) return <p className="text-stone-600">Loading…</p>;
  if (error || !projectId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Create invoice</h1>
        <p className="mt-2 text-sm text-red-700">{error || "Project required."}</p>
      </div>
    );
  }

  return (
    <RecordFormPage
      title="Create invoice"
      subtitle="Pulls every estimate/quote line, plus billable project expenses."
      backHref={`/app/projects/${projectId}?tab=money`}
      backLabel="Project money"
      successHref={(r) => (r.id ? `/app/invoices/${r.id}?projectId=${projectId}&from=project` : `/app/projects/${projectId}?tab=money`)}
      infoPanel={
        <div className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Invoice lines ({preview.length})</p>
          {preview.length === 0 ? (
            <p className="mt-2 text-stone-500">No lines found on the linked estimate/quote.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {preview.map((line, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>
                    {line.description}
                    {line.quantity ? (
                      <span className="text-stone-500">
                        {" "}
                        · {line.quantity}
                        {line.unit ? ` ${line.unit}` : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-medium">{line.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      fields={[
        {
          key: "dueDate",
          label: "Due date",
          type: "date",
          required: true,
          defaultValue: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 15);
            return d.toISOString().slice(0, 10);
          })(),
        },
        { key: "notes", label: "Notes", type: "textarea" },
        {
          key: "projectCompleted",
          label: "Is the project completed?",
          type: "select",
          required: true,
          defaultValue: "no",
          options: [
            { value: "yes", label: "Yes — mark project completed" },
            { value: "no", label: "No — keep in progress" },
          ],
        },
      ]}
      onSubmit={async (form) => {
        const invoice = (await athena.invoices.create(
          {
            projectId,
            kind: form.projectCompleted === "yes" ? "final" : "progress",
            items: preview,
            overrideCap: true,
            taxRate: "0",
          },
          `inv-project-${projectId}-${Date.now()}`,
        )) as { id?: string };
        await athena.projects.update(projectId, {
          status: form.projectCompleted === "yes" ? "completed" : "active",
        });
        if (invoice.id) {
          await athena.invoices.update(invoice.id, {
            notes: form.notes || null,
            dueDate: form.dueDate || null,
          });
        }
        return invoice;
      }}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <CreateInvoiceForm />
    </Suspense>
  );
}
