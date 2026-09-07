"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentPreview } from "@/components/document-preview";
import { ErrorState } from "@/components/states";
import type { AthenaDocument } from "@/lib/documentBranding";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [doc, setDoc] = useState<AthenaDocument | null>(null);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = useCallback(async () => {
    const d = (await athena.invoices.get(id)) as AthenaDocument & {
      notes?: string;
      dueDate?: string;
      customerId?: string;
      projectId?: string;
      outstanding?: string;
      status?: string;
    };
    setDoc(d);
    setNotes(String(d.notes || ""));
    setDueDate(String(d.dueDate || "").slice(0, 10));

    const payRes = await athena.payments.list().catch(() => ({ items: [] as Record<string, unknown>[] }));
    setPayments(payRes.items.filter((p) => String(p.invoiceId) === id));

    if (d.customerId) {
      const c = await athena.customers.get(String(d.customerId)).catch(() => null);
      setCustomerName(c ? String(c.name || "") : null);
    }
    return d;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await athena.invoices.update(id, {
        notes: notes || null,
        dueDate: dueDate || null,
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
  const canEdit = status === "draft" || status === "sent";
  const customerId = record.customerId ? String(record.customerId) : null;
  const projectId = record.projectId ? String(record.projectId) : null;
  const due = Number(outstanding || 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/invoices" className="text-sm text-clay">
            ← Invoices
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{doc.number}</h1>
          <p className="mt-1 text-stone-600">
            {status} · {formatDate(doc.createdAt)} · {formatCurrency(doc.total_amount)}
            {outstanding ? ` · Outstanding ${formatCurrency(String(outstanding))}` : null}
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            {customerId ? (
              <Link href={`/app/customers/${customerId}`} className="text-clay">
                {customerName || "Customer"} →
              </Link>
            ) : null}
            {projectId ? (
              <Link href={`/app/projects/${projectId}`} className="text-clay">
                Project →
              </Link>
            ) : null}
            <Link href="/app/accounting" className="text-clay">
              Accounts →
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {due > 0 ? (
            <Link href={`/app/payments/new?invoiceId=${id}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
              Record payment
            </Link>
          ) : null}
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
        </div>
      </div>

      {canEdit ? (
        <form onSubmit={saveEdits} className="mb-6 grid max-w-xl gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-800">Edit invoice details</p>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Due date</span>
            <input className="rounded-xl border px-3 py-2" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Notes</span>
            <textarea className="rounded-xl border px-3 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save changes"}
            </button>
            {saved ? <span className="text-sm text-emerald-700">Saved</span> : null}
          </div>
        </form>
      ) : (
        <p className="mb-6 text-sm text-stone-500">Paid invoices cannot be edited.</p>
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

      <DocumentPreview doc={doc} kind="invoice" />
    </div>
  );
}
