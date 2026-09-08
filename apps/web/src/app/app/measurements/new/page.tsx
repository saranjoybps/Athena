"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MeasurementEditor } from "@/components/measurement-editor";
import { ErrorState } from "@/components/states";
import { athena, optionsFrom } from "@/lib/athena-client";
import { entityBackHref } from "@/lib/customer-nav";
import {
  buildMeasurementPayload,
  createMeasurementItem,
  type MeasurementItem,
} from "@/lib/measurements";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(!presetSiteId);

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
      const payload = buildMeasurementPayload(items, notes || null);
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
