"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/states";
import { formatCurrency } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => athena.estimates.get(id).then(setDoc), [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [load]);

  if (error) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  const items = (doc.items as Array<Record<string, unknown>>) || [];
  const computed = (doc.computed as Record<string, unknown>) || {};

  return (
    <div>
      <Link href="/app/estimates" className="text-sm text-clay">← Estimates</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{String(doc.title || doc.number || id)}</h1>
          <p className="mt-1 text-stone-600">
            {formatCurrency(String(computed.grandTotal || doc.total || "0"))}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
          onClick={async () => {
            setBusy(true);
            try {
              const q = (await athena.quotes.create({ estimateId: id, validityDays: 15 })) as { id: string };
              router.push(`/app/quotes/${q.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to create quote");
            } finally {
              setBusy(false);
            }
          }}
        >
          Create quotation
        </button>
      </div>
      <div className="mt-6 grid gap-2">
        {items.map((line, idx) => (
          <div key={idx} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-medium">{String(line.description || "Line")}</p>
            <p className="text-sm text-stone-600">
              {String(line.quantity)} {String(line.unit)} · mat {String(line.materialCost || 0)} · lab {String(line.labourCost || 0)}
            </p>
          </div>
        ))}
      </div>
      {doc.assumptions ? <p className="mt-4 text-sm text-stone-600">Assumptions: {String(doc.assumptions)}</p> : null}
    </div>
  );
}
