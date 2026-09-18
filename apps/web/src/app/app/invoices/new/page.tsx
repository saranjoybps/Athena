"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { athena } from "@/lib/athena-client";
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

const fieldClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-clay focus:ring-2 focus:ring-clay/15";

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

  function addBlankLine() {
    setLines((prev) => [
      ...prev,
      { id: newId(), description: "", amount: "0", quantity: "1", unit: "pcs", rate: "0" },
    ]);
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

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0), [lines]);
  const gstAmount = useMemo(() => {
    const pct = Number(gstPercent.trim());
    if (gstPercent.trim() && Number.isFinite(pct) && pct > 0) return subtotal * (pct / 100);
    return 0;
  }, [subtotal, gstPercent]);
  const invoiceTotal = subtotal + gstAmount;

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

  const backHref = projectId ? `/app/projects/${projectId}?tab=money` : "/app/invoices";

  if (!ready) {
    return <p className="text-stone-600">Loading invoice…</p>;
  }

  if (error && !projectId) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold">Create invoice</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Link href="/app/invoices" className="mt-4 inline-block text-sm text-clay">
          ← Invoices
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm text-clay">
            ← {projectId ? "Project money" : "Invoices"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Create invoice</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-600">
            Lines load from the estimate and billable expenses. Adjust amounts, then issue.
          </p>
        </div>
        <div className="rounded-2xl border border-clay/20 bg-gradient-to-br from-orange-50 to-sand px-5 py-3 text-right shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Grand total</p>
          <p className="mt-0.5 text-2xl font-semibold text-clay">{formatCurrency(String(invoiceTotal))}</p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Invoice details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-stone-700">Due date</span>
                <input className={fieldClass} type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-stone-700">GST %</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={gstPercent}
                  placeholder="Optional"
                  onChange={(e) => setGstPercent(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-stone-700">Project status after invoice</span>
                <select className={fieldClass} value={projectCompleted} onChange={(e) => setProjectCompleted(e.target.value)}>
                  <option value="no">Keep in progress (progress invoice)</option>
                  <option value="yes">Mark project completed (final invoice)</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-stone-700">Notes</span>
                <textarea
                  className={`${fieldClass} min-h-[88px] resize-y`}
                  value={notes}
                  placeholder="Payment terms, site notes…"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-sand/40 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Line items</h2>
                <p className="text-xs text-stone-500">
                  {lines.length} line{lines.length === 1 ? "" : "s"} · edit qty or rate to recalc amount
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[200px] rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-clay"
                  value=""
                  aria-label="Add material from catalog"
                  onChange={(e) => {
                    if (e.target.value) addMaterialLine(e.target.value);
                  }}
                >
                  <option value="">{materials.length ? "+ Material from catalog" : "No materials in catalog"}</option>
                  {materials.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                      {m.selling ? ` · ${m.selling}` : m.purchase ? ` · ${m.purchase}` : ""}
                      {m.unit ? ` / ${m.unit}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addBlankLine}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-clay hover:text-clay"
                >
                  + Blank line
                </button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-stone-500">No lines yet. Add a material or a blank line.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {lines.map((line, idx) => (
                  <li key={line.id} className="px-5 py-4 transition hover:bg-sand/30">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-clay/10 px-2 text-xs font-semibold text-clay">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                        onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                      >
                        Remove
                      </button>
                    </div>
                    <label className="grid gap-1.5 text-sm">
                      <span className="sr-only">Description</span>
                      <input
                        className={fieldClass}
                        list={`inv-materials-${line.id}`}
                        placeholder="Description"
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
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-stone-500">Qty</span>
                        <input
                          className={fieldClass}
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-stone-500">Unit</span>
                        <input className={fieldClass} value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-stone-500">Rate</span>
                        <input
                          className={fieldClass}
                          type="number"
                          value={line.rate}
                          onChange={(e) => updateLine(line.id, { rate: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-stone-500">Amount</span>
                        <input
                          className={`${fieldClass} font-semibold`}
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
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3 text-stone-600">
                <dt>Subtotal</dt>
                <dd className="font-medium text-ink">{formatCurrency(String(subtotal))}</dd>
              </div>
              {gstAmount > 0 ? (
                <div className="flex justify-between gap-3 text-stone-600">
                  <dt>GST ({gstPercent}%)</dt>
                  <dd className="font-medium text-ink">{formatCurrency(String(gstAmount))}</dd>
                </div>
              ) : (
                <div className="flex justify-between gap-3 text-stone-400">
                  <dt>GST</dt>
                  <dd>—</dd>
                </div>
              )}
              <div className="border-t border-stone-100 pt-3">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="text-lg font-semibold text-clay">{formatCurrency(String(invoiceTotal))}</dd>
                </div>
              </div>
            </dl>

            <p className="mt-4 rounded-xl bg-sand px-3 py-2 text-xs leading-relaxed text-stone-500">
              {projectCompleted === "yes"
                ? "This will create a final invoice and mark the project completed."
                : "This will create a progress invoice and keep the project active."}
            </p>

            <button
              type="submit"
              disabled={busy || !lines.length}
              className="mt-5 w-full rounded-xl bg-clay py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-clay/90 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create invoice"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <CreateInvoiceForm />
    </Suspense>
  );
}
