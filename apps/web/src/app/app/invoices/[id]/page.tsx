"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DocumentPreview } from "@/components/document-preview";
import { ErrorState } from "@/components/states";
import type { AthenaDocument } from "@/lib/documentBranding";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";
import { invoiceBackHref, paymentNavHref } from "@/lib/money-nav";

type InvoiceLine = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  amount: string;
};

function newLineId() {
  return `il-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function lineFromDoc(line: Record<string, unknown>, idx: number): InvoiceLine {
  const qty = String(line.quantity || "1");
  const rate = line.rate != null ? String(line.rate) : line.unit_price != null ? String(line.unit_price) : "";
  return {
    id: `${idx}-${newLineId()}`,
    description: String(line.description || ""),
    quantity: qty,
    unit: String(line.unit || ""),
    rate,
    amount: String(line.amount || line.subtotal || line.total || "0"),
  };
}

function InvoiceDetailInner() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const id = String(params.id);
  const queryProjectId = search.get("projectId") || "";
  const from = search.get("from") || "";
  const [doc, setDoc] = useState<AthenaDocument | null>(null);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [materials, setMaterials] = useState<
    Array<{ value: string; label: string; unit?: string; purchase?: string; selling?: string }>
  >([]);

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
          })),
        ),
      )
      .catch(() => setMaterials([]));
  }, []);

  const load = useCallback(async () => {
    const d = (await athena.invoices.get(id)) as AthenaDocument & {
      notes?: string;
      dueDate?: string;
      customerId?: string;
      projectId?: string;
      outstanding?: string;
      status?: string;
      total?: string;
    };
    setDoc(d);
    setNotes(String(d.notes || ""));
    setDueDate(String(d.dueDate || "").slice(0, 10));
    const rawLines =
      ((d as Record<string, unknown>).line_items as Array<Record<string, unknown>>) ||
      ((d as Record<string, unknown>).items as Array<Record<string, unknown>>) ||
      [];
    setLines(rawLines.map(lineFromDoc));

    const payRes = await athena.payments.list().catch(() => ({ items: [] as Record<string, unknown>[] }));
    setPayments(payRes.items.filter((p) => String(p.invoiceId) === id));

    if (d.customerId) {
      const c = await athena.customers.get(String(d.customerId)).catch(() => null);
      setCustomer(c);
    }
    return d;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  function updateLine(lineId: string, patch: Partial<InvoiceLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        if (patch.quantity !== undefined || patch.rate !== undefined) {
          const qty = Number(next.quantity || 0);
          const rate = Number(next.rate || 0);
          if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate)) {
            next.amount = String(qty * rate);
          }
        }
        return next;
      }),
    );
  }

  function applyMaterial(lineId: string, materialId: string) {
    const match = materials.find((m) => m.value === materialId);
    if (!match) return;
    const rate = match.selling || match.purchase || "0";
    updateLine(lineId, {
      description: match.label,
      unit: match.unit || "pcs",
      rate,
      quantity: "1",
      amount: String(Number(rate || 0)),
    });
  }

  function addMaterialLine(materialId: string) {
    const match = materials.find((m) => m.value === materialId);
    if (!match) return;
    const rate = match.selling || match.purchase || "0";
    setLines((prev) => [
      ...prev,
      {
        id: newLineId(),
        description: match.label,
        quantity: "1",
        unit: match.unit || "pcs",
        rate,
        amount: String(Number(rate || 0)),
      },
    ]);
  }

  const linesTotal = useMemo(() => lines.reduce((sum, l) => sum + Number(l.amount || 0), 0), [lines]);

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await athena.invoices.update(id, {
        notes: notes || null,
        dueDate: dueDate || null,
        items: lines.map(({ description, amount, quantity, unit, rate }) => ({
          description,
          amount,
          quantity,
          unit,
          rate,
        })),
      });
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !doc) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  const record = doc as Record<string, unknown>;
  const status = String(record.status || "draft");
  const outstanding = record.outstanding;
  const canEdit = status === "draft" || status === "sent" || status === "partially_paid";
  const customerId = record.customerId ? String(record.customerId) : null;
  const projectId = queryProjectId || (record.projectId ? String(record.projectId) : null);
  const due = Number(outstanding || 0);
  const amount = String(record.total || record.total_amount || outstanding || "0");
  const backHref = invoiceBackHref({
    projectId,
    from: from || (projectId ? "project" : null),
    customerId,
  });
  const backLabel =
    from === "accounts"
      ? "Accounts"
      : from === "payments"
        ? "Payments"
        : from === "customer"
          ? "Customer money"
          : projectId
            ? "Project money"
            : "Projects";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm text-clay">
            ← {backLabel}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{doc.number}</h1>
          <p className="mt-1 text-stone-600">
            {status} · {formatDate(doc.createdAt)} · {formatCurrency(doc.total_amount)}
            {outstanding ? ` · Outstanding ${formatCurrency(String(outstanding))}` : null}
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            {customerId ? (
              <Link href={`/app/customers/${customerId}?tab=money`} className="text-clay">
                {String(customer?.name || "Customer")} →
              </Link>
            ) : null}
            {projectId ? (
              <Link href={`/app/projects/${projectId}?tab=money`} className="text-clay">
                Project money →
              </Link>
            ) : null}
            <Link href="/app/accounting?tab=receivables" className="text-clay">
              Accounts →
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "draft" ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm"
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await athena.invoices.send(id);
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to send");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Mark Sent
            </button>
          ) : null}
          {status === "sent" || status === "partially_paid" ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
              onClick={() =>
                router.push(
                  paymentNavHref({
                    invoiceId: id,
                    projectId,
                    from: from || "project",
                    amount: String(due || amount),
                  }),
                )
              }
            >
              Record payment
            </button>
          ) : null}
          {status !== "void" && status !== "paid" ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await athena.invoices.update(id, { status: "void" });
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to void");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Void
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {canEdit ? (
        <form onSubmit={saveEdits} className="mb-6 grid gap-4">
          <div className="grid max-w-xl gap-3 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-800">Edit invoice details</p>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Due date</span>
              <input className="rounded-xl border px-3 py-2" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Notes</span>
              <textarea className="rounded-xl border px-3 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Line items</h2>
              <label className="grid gap-1 text-sm">
                <span className="sr-only">Add material line</span>
                <select
                  className="rounded-xl border px-3 py-2"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addMaterialLine(e.target.value);
                  }}
                >
                  <option value="">{materials.length ? "+ Add from catalog" : "No materials in catalog"}</option>
                  {materials.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {lines.map((line, index) => (
              <div key={line.id} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-stone-800">Line {index + 1}</p>
                  <button type="button" className="text-sm text-red-700" onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}>
                    Remove
                  </button>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Material from catalog</span>
                  <select
                    className="rounded-xl border px-3 py-2"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) applyMaterial(line.id, e.target.value);
                    }}
                  >
                    <option value="">Select material…</option>
                    {materials.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Description</span>
                  <input className="rounded-xl border px-3 py-2" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Qty</span>
                    <input className="rounded-xl border px-3 py-2" type="number" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Unit</span>
                    <input className="rounded-xl border px-3 py-2" value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Rate</span>
                    <input className="rounded-xl border px-3 py-2" type="number" value={line.rate} onChange={(e) => updateLine(line.id, { rate: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-stone-700">Amount</span>
                    <input className="rounded-xl border px-3 py-2" type="number" value={line.amount} onChange={(e) => updateLine(line.id, { amount: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="w-fit text-sm text-clay"
              onClick={() =>
                setLines((prev) => [...prev, { id: newLineId(), description: "", quantity: "1", unit: "pcs", rate: "0", amount: "0" }])
              }
            >
              + Add line
            </button>
            <p className="text-sm text-stone-600">Lines total: {formatCurrency(String(linesTotal))}</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save changes"}
            </button>
            {saved ? <span className="text-sm text-emerald-700">Saved</span> : null}
          </div>
        </form>
      ) : (
        <p className="mb-6 text-sm text-stone-500">
          {status === "void" ? "Voided invoices are excluded from Accounts." : "Paid invoices cannot be edited."}
        </p>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Payments on this invoice</h2>
        <div className="grid gap-2">
          {payments.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">No payments recorded yet.</p>
          ) : null}
          {payments.map((p) => (
            <div key={String(p.id)} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">
                {formatCurrency(String(p.amount || "0"))} · {String(p.method || "")}
              </p>
              <p className="text-sm text-stone-600">
                {formatDate(String(p.createdAt || ""))}
                {p.reference ? ` · ${p.reference}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <DocumentPreview
        doc={doc}
        kind="invoice"
        whatsappPhone={String(customer?.phone || "")}
        whatsappMessage={`Invoice ${String(doc.number || "")} — ${formatCurrency(String(amount))}. Status: ${status}.`}
      />
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <InvoiceDetailInner />
    </Suspense>
  );
}
