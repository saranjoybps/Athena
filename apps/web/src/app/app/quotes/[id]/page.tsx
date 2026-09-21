"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentPreview } from "@/components/document-preview";
import { DocumentSendActions } from "@/components/document-send-actions";
import { ErrorState } from "@/components/states";
import type { AthenaDocument } from "@/lib/documentBranding";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [doc, setDoc] = useState<AthenaDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState("15");

  const load = useCallback(
    () =>
      athena.quotes.get(id).then((d) => {
        const record = d as AthenaDocument & { notes?: string; validityDays?: number };
        setDoc(record);
        setNotes(String(record.notes || ""));
        setValidityDays(String(record.validityDays ?? 15));
        return record;
      }),
    [id],
  );

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await athena.quotes.update(id, {
        notes: notes || null,
        validityDays: Number(validityDays || 15),
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

  const status = String((doc as Record<string, unknown>).status || "draft");
  const canEdit = status === "draft" || status === "modification_requested";
  const customer = (doc as Record<string, unknown>).customer as
    | { phone?: string; email?: string; name?: string }
    | undefined;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/quotes" className="text-sm text-clay">
            ← Estimates
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{doc.number}</h1>
          <p className="mt-1 text-stone-600">
            {status} · {formatDate(doc.createdAt)} · {formatCurrency(doc.total_amount)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "draft" || status === "sent" || status === "modification_requested" ? (
            <>
              <button type="button" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white" onClick={() => act(() => athena.quotes.accept(id))}>
                Accept
              </button>
              <button type="button" disabled={busy} className="rounded-xl border px-4 py-2 text-sm" onClick={() => act(() => athena.quotes.reject(id))}>
                Reject
              </button>
            </>
          ) : null}
          {status === "accepted" ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-clay px-4 py-2 text-sm text-white"
              onClick={() =>
                act(async () => {
                  const inv = (await athena.invoices.fromQuote(id, {}, `inv-from-${id}`)) as { id: string };
                  router.push(`/app/invoices/${inv.id}`);
                })
              }
            >
              Create Invoice
            </button>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <form onSubmit={saveEdits} className="mb-6 grid max-w-xl gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-800">Edit estimate details</p>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Validity (days)</span>
            <input className="rounded-xl border px-3 py-2" type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
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
        <p className="mb-6 text-sm text-stone-500">Notes and validity are locked after the estimate is sent.</p>
      )}

      <DocumentSendActions
        kind="quotation"
        docId={id}
        number={doc.number ? String(doc.number) : null}
        pdfUrl={(doc as Record<string, unknown>).pdfUrl ? String((doc as Record<string, unknown>).pdfUrl) : null}
        customerPhone={customer?.phone}
        customerEmail={customer?.email}
        onSent={() => load()}
        onPdfReady={() => load()}
      />

      <DocumentPreview doc={doc} kind="quotation" onPdfReady={() => load()} />
    </div>
  );
}
