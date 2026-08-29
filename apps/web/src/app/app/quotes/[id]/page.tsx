"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentPreview } from "@/components/document-preview";
import { ErrorState } from "@/components/states";
import type { FabricaDocument } from "@/lib/documentBranding";
import { formatCurrency, formatDate } from "@/lib/format";
import { fabrica } from "@/lib/fabrica-client";

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [doc, setDoc] = useState<FabricaDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fabrica.quotes.get(id).then((d) => setDoc(d as FabricaDocument)), [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  const status = String((doc as Record<string, unknown>).status || "draft");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/quotes" className="text-sm text-clay">
            ← Quotations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{doc.number}</h1>
          <p className="mt-1 text-stone-600">
            {status} · {formatDate(doc.createdAt)} · {formatCurrency(doc.total_amount)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "draft" ? (
            <button type="button" disabled={busy} className="rounded-xl border px-4 py-2 text-sm" onClick={() => act(() => fabrica.quotes.send(id))}>
              Send
            </button>
          ) : null}
          {status === "sent" ? (
            <>
              <button type="button" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white" onClick={() => act(() => fabrica.quotes.accept(id))}>
                Accept
              </button>
              <button type="button" disabled={busy} className="rounded-xl border px-4 py-2 text-sm" onClick={() => act(() => fabrica.quotes.reject(id))}>
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
                  const inv = (await fabrica.invoices.fromQuote(id, {}, `inv-from-${id}`)) as { id: string };
                  router.push(`/app/invoices/${inv.id}`);
                })
              }
            >
              Create Invoice
            </button>
          ) : null}
        </div>
      </div>
      <DocumentPreview doc={doc} kind="quotation" />
    </div>
  );
}
