"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { athena } from "@/lib/athena-client";
import { DocumentFormChrome, DocSection, DocTotals } from "@/components/document-form-chrome";
import { formatCurrency } from "@/lib/format";

type InvoiceLine = {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  unit: string;
  rate: string;
  hsn?: string;
  gstRate?: string;
};

type MaterialOpt = {
  value: string;
  label: string;
  unit?: string;
  purchase?: string;
  selling?: string;
  hsn?: string;
  gstRate?: string;
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

function linesFromQuote(quote: Record<string, unknown>): Omit<InvoiceLine, "id">[] {
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

function newId() {
  return `il-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function withIds(lines: Omit<InvoiceLine, "id">[]): InvoiceLine[] {
  return lines.map((line) => ({ ...line, id: newId() }));
}

function CreateInvoiceForm() {
  const router = useRouter();
  const search = useSearchParams();
  const projectId = search.get("projectId") || "";
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [projectCompleted, setProjectCompleted] = useState("no");
  const [gstPercent, setGstPercent] = useState("");

  useEffect(() => {
    athena.materials
      .list()
      .then((res) =>
        setMaterials(
          (res.items || []).map((m) => ({
            value: String(m.id),
            label: String(m.name || m.sku || m.id),
            unit: m.unit ? String(m.unit) : undefined,
            purchase: m.defaultPurchasePrice ? String(m.defaultPurchasePrice) : undefined,
            selling: m.defaultSellingPrice ? String(m.defaultSellingPrice) : undefined,
            hsn: m.hsn ? String(m.hsn) : undefined,
            gstRate: m.gstRate != null ? String(m.gstRate) : undefined,
          })),
        ),
      )
      .catch(() => setMaterials([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setError("Open Create Invoice from a project.");
      setReady(true);
      return;
    }
    Promise.all([athena.projects.get(projectId), athena.expenses.list(projectId)])
      .then(async ([project, expenses]) => {
        const quoteId = String(project.quoteId || "");
        let items: Omit<InvoiceLine, "id">[] = [];

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
        setLines(withIds(items));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to prepare invoice"))
      .finally(() => setReady(true));
  }, [projectId]);

  function updateLine(id: string, patch: Partial<InvoiceLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        const qty = Number(next.quantity || 0);
        const rate = Number(next.rate || 0);
        if (patch.quantity !== undefined || patch.rate !== undefined) {
          if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
            next.amount = String(qty * rate);
          }
        }
        return next;
      }),
    );
  }

  function addMaterialLine(materialId: string) {
    const match = materials.find((m) => m.value === materialId);
    if (!match) return;
    const rate = match.selling || match.purchase || "0";
    const qty = "1";
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        description: match.hsn ? `${match.label} (HSN ${match.hsn})` : match.label,
        quantity: qty,
        unit: match.unit || "pcs",
        rate,
        amount: String(Number(qty) * Number(rate || 0)),
        hsn: match.hsn,
        gstRate: match.gstRate,
      },
    ]);
    if (match.gstRate && !gstPercent.trim()) {
      const pct = Number(match.gstRate) * 100;
      if (Number.isFinite(pct) && pct > 0) setGstPercent(String(pct));
    }
  }

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [lines],
  );
  const invoiceTotal = useMemo(() => {
    const pct = Number(gstPercent.trim());
    if (gstPercent.trim() && Number.isFinite(pct) && pct > 0) return subtotal * (1 + pct / 100);
    return subtotal;
  }, [subtotal, gstPercent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !lines.length) return;
    setBusy(true);
    setError(null);
    try {
      const pct = Number(gstPercent.trim());
      const taxRate = gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";
      const invoice = (await athena.invoices.create(
        {
          projectId,
          kind: projectCompleted === "yes" ? "final" : "progress",
          items: lines.map(({ description, amount, quantity, unit, rate, hsn, gstRate }) => ({
            description,
            amount,
            quantity,
            unit,
            rate,
            ...(hsn ? { hsn } : {}),
            ...(gstRate ? { gstRate } : {}),
          })),
          overrideCap: true,
          taxRate,
        },
        `inv-project-${projectId}-${Date.now()}`,
      )) as { id?: string };
      await athena.projects.update(projectId, {
        status: projectCompleted === "yes" ? "completed" : "active",
      });
      if (invoice.id) {
        await athena.invoices.update(invoice.id, {
          notes: notes || null,
          dueDate: dueDate || null,
        });
        router.push(`/app/invoices/${invoice.id}?projectId=${projectId}&from=project`);
      } else {
        router.push(`/app/projects/${projectId}?tab=money`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-stone-600">Loading…</p>;
  if (error && !projectId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Create invoice</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <DocumentFormChrome
      title="Create invoice"
      subtitle="Estimate lines and billable expenses load below. Add materials or edit amounts before saving."
      backHref={projectId ? `/app/projects/${projectId}?tab=money` : "/app/invoices"}
      backLabel={projectId ? "Project money" : "Invoices"}
      accent="clay"
      footer={
        <button
          type="submit"
          form="invoice-create-form"
          disabled={busy || !lines.length}
          className="rounded-xl bg-clay px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create invoice"}
        </button>
      }
    >
    <form id="invoice-create-form" onSubmit={submit} className="grid gap-2">
      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <DocSection title="Details">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Due date *</span>
          <input className="rounded-xl border px-3 py-2" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">GST % (optional)</span>
          <input
            className="rounded-xl border px-3 py-2"
            type="number"
            value={gstPercent}
            placeholder="Leave blank for no GST"
            onChange={(e) => setGstPercent(e.target.value)}
          />
        </label>
      </div>

      <label className="mt-3 grid gap-1 text-sm">
        <span className="font-medium text-stone-700">Notes</span>
        <textarea className="rounded-xl border px-3 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <label className="mt-3 grid gap-1 text-sm">
        <span className="font-medium text-stone-700">Is the project completed?</span>
        <select className="rounded-xl border px-3 py-2" value={projectCompleted} onChange={(e) => setProjectCompleted(e.target.value)}>
          <option value="no">No — keep in progress</option>
          <option value="yes">Yes — mark project completed</option>
        </select>
      </label>
      </DocSection>

      <DocSection title="Line items">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-stone-600">{lines.length} line{lines.length === 1 ? "" : "s"}</p>
          <label className="grid min-w-[240px] flex-1 gap-1 text-sm sm:max-w-sm">
            <span className="font-medium text-stone-700">Add material from catalog</span>
            <select
              className="rounded-xl border px-3 py-2"
              value=""
              onChange={(e) => {
                if (e.target.value) addMaterialLine(e.target.value);
              }}
            >
              <option value="">
                {materials.length ? "Select a material…" : "No materials in catalog yet"}
              </option>
              {materials.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                  {m.selling ? ` · ${m.selling}` : m.purchase ? ` · ${m.purchase}` : ""}
                  {m.unit ? ` / ${m.unit}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-2xl border bg-sand/40 p-4 text-sm text-stone-500">No lines yet — add a material or check the linked estimate.</p>
        ) : (
          <ul className="grid gap-3">
            {lines.map((line, idx) => (
              <li key={line.id} className="grid gap-3 rounded-2xl border bg-sand/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-700">Line {idx + 1}</p>
                  <button
                    type="button"
                    className="text-sm text-red-700"
                    onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                  >
                    Remove
                  </button>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Description</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    list={`inv-materials-${line.id}`}
                    value={line.description}
                    onChange={(e) => {
                      const next = e.target.value;
                      const match = materials.find((m) => m.label === next);
                      if (match) {
                        const rate = match.selling || match.purchase || line.rate;
                        updateLine(line.id, {
                          description: next,
                          unit: match.unit || line.unit,
                          rate,
                          amount: String(Number(line.quantity || 1) * Number(rate || 0)),
                        });
                      } else {
                        updateLine(line.id, { description: next });
                      }
                    }}
                  />
                  <datalist id={`inv-materials-${line.id}`}>
                    {materials.map((m) => (
                      <option key={m.value} value={m.label} />
                    ))}
                  </datalist>
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Qty</span>
                    <input
                      className="rounded-xl border px-3 py-2"
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Unit</span>
                    <input className="rounded-xl border px-3 py-2" value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Rate</span>
                    <input
                      className="rounded-xl border px-3 py-2"
                      type="number"
                      value={line.rate}
                      onChange={(e) => updateLine(line.id, { rate: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Amount</span>
                    <input
                      className="rounded-xl border px-3 py-2"
                      type="number"
                      value={line.amount}
                      onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DocSection>

      <DocSection title="Totals">
        <DocTotals
          rows={[
            { label: "Subtotal", value: formatCurrency(String(subtotal)) },
            ...(gstPercent.trim()
              ? [{ label: `GST (${gstPercent}%)`, value: formatCurrency(String(invoiceTotal - subtotal)) }]
              : []),
            { label: "Grand total", value: formatCurrency(String(invoiceTotal)), emphasis: true },
          ]}
        />
      </DocSection>
    </form>
    </DocumentFormChrome>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <CreateInvoiceForm />
    </Suspense>
  );
}
