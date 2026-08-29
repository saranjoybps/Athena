"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentPreview } from "@/components/document-preview";
import { ErrorState } from "@/components/states";
import type { FabricaDocument } from "@/lib/documentBranding";
import { formatCurrency, formatDate } from "@/lib/format";
import { fabrica } from "@/lib/fabrica-client";

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [doc, setDoc] = useState<FabricaDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fabrica.invoices.get(id).then((d) => setDoc(d as FabricaDocument)), [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  if (error) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  const status = String((doc as Record<string, unknown>).status || "draft");
  const outstanding = (doc as Record<string, unknown>).outstanding;

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
        </div>
        {status === "draft" ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-clay px-4 py-2 text-sm text-white"
            onClick={async () => {
              setBusy(true);
              try {
                await fabrica.invoices.send(id);
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
      <DocumentPreview doc={doc} kind="invoice" />
    </div>
  );
}
