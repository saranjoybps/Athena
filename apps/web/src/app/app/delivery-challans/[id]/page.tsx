"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { formatDate } from "@/lib/format";

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    athena.deliveryChallans
      .get(id)
      .then(setDoc)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function makePdf() {
    setBusy(true);
    try {
      const updated = await athena.deliveryChallans.pdf(id);
      setDoc(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !doc) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  const customer = (doc.customer as { name?: string } | undefined)?.name;
  const items = (doc.items as Array<Record<string, unknown>>) || [];
  const pdfUrl = doc.pdfUrl ? String(doc.pdfUrl) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/delivery-challans" className="text-sm text-clay">
        ← Delivery challans
      </Link>
      <div className="mt-2 rounded-2xl border border-l-4 border-stone-200 border-l-emerald-600 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{String(doc.number || doc.id)}</h1>
            <p className="mt-1 text-sm text-stone-600">
              {[customer, doc.date ? formatDate(String(doc.date)) : null, doc.status ? String(doc.status) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            {pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-sm font-semibold text-clay">
                Open PDF
              </a>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={makePdf}
              className="rounded-xl bg-clay px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Generating…" : pdfUrl ? "Refresh PDF" : "Generate PDF"}
            </button>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Vehicle</dt>
            <dd className="font-medium">{String(doc.vehicleNumber || "—")}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Receiver</dt>
            <dd className="font-medium">{String(doc.receiverName || "—")}</dd>
          </div>
          {doc.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Notes</dt>
              <dd className="font-medium">{String(doc.notes)}</dd>
            </div>
          ) : null}
        </dl>

        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-stone-500">Lines</h2>
        <ul className="mt-2 divide-y rounded-xl border">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-stone-500">No lines</li>
          ) : (
            items.map((line, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>{String(line.description || "Line")}</span>
                <span className="shrink-0 text-stone-600">
                  {String(line.quantity || "1")} {String(line.unit || "")}
                </span>
              </li>
            ))
          )}
        </ul>
        {doc.receiverSignatureUrl ? (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Receiver signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={String(doc.receiverSignatureUrl)} alt="Receiver signature" className="mt-2 max-h-40 rounded-xl border bg-sand/40 p-2" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
