"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MeasurementEditor } from "@/components/measurement-editor";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { entityBackHref } from "@/lib/customer-nav";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { buildMeasurementPayload, parseMeasurementItems, type MeasurementItem } from "@/lib/measurements";

type PhotoRow = { name: string; url: string; publicId?: string };

function MeasurementDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const queryCustomerId = search.get("customerId") || "";
  const fromSite = search.get("fromSite") || "";
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [notes, setNotes] = useState("");
  const [billBySqft, setBillBySqft] = useState(false);
  const [perSqftRate, setPerSqftRate] = useState("");
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    return athena.measurements.get(id).then((d) => {
      setDoc(d);
      setItems(parseMeasurementItems(d));
      setNotes(String(d.notes || ""));
      setBillBySqft(Boolean(d.billBySqft));
      setPerSqftRate(d.perSqftRate != null ? String(d.perSqftRate) : "");
      const rawPhotos = Array.isArray(d.photos) ? d.photos : [];
      setPhotos(
        rawPhotos.map((p) => {
          const row = p as Record<string, unknown>;
          return {
            name: String(row.name || "photo"),
            url: String(row.url || ""),
            publicId: row.publicId ? String(row.publicId) : undefined,
          };
        }).filter((p) => p.url),
      );
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

  async function onPhotos(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setError(null);
    try {
      const folder = siteId ? `athena/measurements/${siteId}` : "athena/measurements";
      const uploaded: PhotoRow[] = [];
      for (const file of Array.from(fileList)) {
        const res = await uploadToCloudinary(file, folder);
        uploaded.push({ name: file.name, url: res.url, publicId: res.publicId });
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      if (!items.length) throw new Error("Add at least one measurement item");
      if (billBySqft && !perSqftRate.trim()) throw new Error("Enter per sqft rate for contract billing");
      const payload = buildMeasurementPayload(items, notes || null, {
        billBySqft,
        perSqftRate: perSqftRate || null,
        photos,
      });
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
      <p className="mt-1 text-stone-600">Update items, contract billing, and photos.</p>

      <form onSubmit={save} className="mt-6 grid gap-4">
        <MeasurementEditor items={items} onChange={setItems} />

        <div className="grid max-w-3xl gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={billBySqft} onChange={(e) => setBillBySqft(e.target.checked)} />
            <span>
              <span className="font-medium text-stone-900">Bill by sqft (contract)</span>
              <span className="mt-0.5 block text-stone-500">
                When checked, invoices use total area × per sqft rate instead of schedule labour.
              </span>
            </span>
          </label>
          {billBySqft ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Per sqft rate *</span>
              <input
                className="rounded-xl border px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                required={billBySqft}
                value={perSqftRate}
                onChange={(e) => setPerSqftRate(e.target.value)}
              />
            </label>
          ) : null}
        </div>

        <div className="grid max-w-3xl gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-stone-800">Photos</p>
              <p className="text-xs text-stone-500">Optional measurement photos.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => photoRef.current?.click()}
            >
              Add photos
            </button>
            <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPhotos(e.target.files)} />
          </div>
          {photos.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
        </div>

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
