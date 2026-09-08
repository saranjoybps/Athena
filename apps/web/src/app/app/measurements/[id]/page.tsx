"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MeasurementEditor } from "@/components/measurement-editor";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { entityBackHref } from "@/lib/customer-nav";
import { buildMeasurementPayload, parseMeasurementItems, type MeasurementItem } from "@/lib/measurements";

function MeasurementDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const queryCustomerId = search.get("customerId") || "";
  const fromSite = search.get("fromSite") || "";
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return athena.measurements.get(id).then((d) => {
      setDoc(d);
      setItems(parseMeasurementItems(d));
      setNotes(String(d.notes || ""));
      return d;
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  const customerId = queryCustomerId || String(doc?.customerId || "");
  const siteId = fromSite || String(doc?.siteId || "");
  const backHref = entityBackHref({
    customerId,
    tab: "measurements",
    siteId: siteId || null,
    siteTab: "measurements",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      if (!items.length) throw new Error("Add at least one measurement item");
      const payload = buildMeasurementPayload(items, notes || null);
      await athena.measurements.update(id, {
        customerId: doc.customerId,
        siteId: doc.siteId,
        surveyId: doc.surveyId || null,
        ...payload,
      });
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !doc) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  return (
    <div>
      <Link href={backHref} className="text-sm text-clay">
        ← {siteId ? "Site measurements" : "Back"}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit measurement</h1>
      <p className="mt-1 text-stone-600">Update items, recalculate quantities, and keep estimate references accurate.</p>

      <form onSubmit={save} className="mt-6 grid gap-4">
        <MeasurementEditor items={items} onChange={setItems} />
        <label className="grid max-w-3xl gap-1 text-sm">
          <span className="font-medium text-stone-700">Notes</span>
          <textarea className="rounded-xl border px-3 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error ? <ErrorState message={error} /> : null}
        <button type="submit" disabled={busy} className="w-fit rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <MeasurementDetailInner />
    </Suspense>
  );
}
