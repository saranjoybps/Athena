"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MeasurementEditor } from "@/components/measurement-editor";
import { ErrorState } from "@/components/states";
import { athena, optionsFrom } from "@/lib/athena-client";
import { entityBackHref } from "@/lib/customer-nav";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  buildMeasurementPayload,
  createMeasurementItem,
  type MeasurementItem,
} from "@/lib/measurements";

type PhotoRow = { name: string; url: string; publicId?: string };

function NewMeasurementForm() {
  const router = useRouter();
  const search = useSearchParams();
  const presetSiteId = search.get("siteId") || "";
  const presetCustomerId = search.get("customerId") || "";
  const [customerId, setCustomerId] = useState(presetCustomerId);
  const [siteId, setSiteId] = useState(presetSiteId);
  const [surveyId, setSurveyId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<MeasurementItem[]>([createMeasurementItem("room", "Room 1")]);
  const [customers, setCustomers] = useState<Array<{ value: string; label: string }>>([]);
  const [sites, setSites] = useState<Array<{ value: string; label: string }>>([]);
  const [surveys, setSurveys] = useState<Array<{ value: string; label: string }>>([]);
  const [billBySqft, setBillBySqft] = useState(false);
  const [perSqftRate, setPerSqftRate] = useState("");
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(!presetSiteId);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    optionsFrom(athena.customers.list).then(setCustomers).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!presetSiteId) {
      setReady(true);
      return;
    }
    athena.sites
      .get(presetSiteId)
      .then((s) => {
        setCustomerId(String(s.customerId || presetCustomerId));
        setSiteId(presetSiteId);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [presetSiteId, presetCustomerId]);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      return;
    }
    optionsFrom(() => athena.sites.list(customerId))
      .then((opts) => {
        setSites(opts);
        if (siteId && !opts.some((o) => o.value === siteId)) setSiteId("");
      })
      .catch(() => setSites([]));
  }, [customerId, siteId]);

  useEffect(() => {
    if (!siteId) {
      setSurveys([]);
      setSurveyId("");
      return;
    }
    optionsFrom(() => athena.surveys.list(siteId), ["number", "id"])
      .then(setSurveys)
      .catch(() => setSurveys([]));
  }, [siteId]);

  const backHref = entityBackHref({
    customerId: customerId || presetCustomerId,
    tab: "measurements",
    siteId: null,
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
    setBusy(true);
    setError(null);
    try {
      if (!customerId) throw new Error("Customer is required");
      if (!siteId) throw new Error("Site is required");
      if (!items.length) throw new Error("Add at least one measurement item");
      for (const item of items) {
        if (!item.label.trim()) throw new Error("Each item needs a label");
      }
      if (billBySqft && !perSqftRate.trim()) throw new Error("Enter per sqft rate for contract billing");
      const payload = buildMeasurementPayload(items, notes || null, {
        billBySqft,
        perSqftRate: perSqftRate || null,
        photos,
      });
      await athena.measurements.create({
        customerId,
        siteId,
        surveyId: surveyId || null,
        ...payload,
      });
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-stone-600">Loading…</p>;

  return (
    <div>
      <Link href={backHref} className="text-sm text-clay">
        ← {presetSiteId || siteId ? "Site measurements" : "Back"}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New measurement</h1>
      <p className="mt-1 text-stone-600">Add multiple takeoff items for this site, then use them on the estimate.</p>

      <form onSubmit={save} className="mt-6 grid gap-4">
        <div className="grid max-w-3xl gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Customer *</span>
            <select
              className="rounded-xl border px-3 py-2"
              value={customerId}
              required
              disabled={Boolean(presetSiteId || presetCustomerId)}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select…</option>
              {customers.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Site *</span>
            <select className="rounded-xl border px-3 py-2" value={siteId} required onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Select…</option>
              {sites.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Survey</span>
            <select className="rounded-xl border px-3 py-2" value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
              <option value="">Optional…</option>
              {surveys.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

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
                placeholder="e.g. 18"
              />
            </label>
          ) : null}
        </div>

        <div className="grid max-w-3xl gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-stone-800">Photos</p>
              <p className="text-xs text-stone-500">Optional site measurement photos.</p>
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
          {busy ? "Saving…" : "Save measurement"}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <NewMeasurementForm />
    </Suspense>
  );
}
