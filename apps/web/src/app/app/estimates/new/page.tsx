"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorState } from "@/components/states";
import { athena, optionsFrom } from "@/lib/athena-client";
import { entityBackHref } from "@/lib/customer-nav";
import { measurementLineOptions } from "@/lib/measurements";

type EstimateLine = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  materialCost: string;
  labourCost: string;
  measurementRef: string;
};

function newLine(): EstimateLine {
  return {
    id: `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    description: "",
    quantity: "1",
    unit: "sqft",
    rate: "",
    materialCost: "0",
    labourCost: "0",
    measurementRef: "",
  };
}

function NewEstimateForm() {
  const router = useRouter();
  const search = useSearchParams();
  const presetCustomerId = search.get("customerId") || "";
  const presetSiteId = search.get("siteId") || "";
  const [customerId, setCustomerId] = useState(presetCustomerId);
  const [siteId, setSiteId] = useState(presetSiteId);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<EstimateLine[]>([{ ...newLine(), description: "Painting works" }]);
  const [customers, setCustomers] = useState<Array<{ value: string; label: string }>>([]);
  const [sites, setSites] = useState<Array<{ value: string; label: string }>>([]);
  const [measurements, setMeasurements] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    optionsFrom(athena.customers.list).then(setCustomers).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!presetSiteId || customerId) return;
    athena.sites
      .get(presetSiteId)
      .then((s) => {
        if (s.customerId) setCustomerId(String(s.customerId));
      })
      .catch(() => undefined);
  }, [presetSiteId, customerId]);

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
    if (!customerId) {
      setMeasurements([]);
      return;
    }
    athena.measurements
      .list(siteId || undefined)
      .then((res) => {
        setMeasurements(
          res.items.filter((m) => {
            if (String(m.customerId || "") !== customerId) return false;
            if (siteId && String(m.siteId || "") !== siteId) return false;
            return true;
          }),
        );
      })
      .catch(() => setMeasurements([]));
  }, [customerId, siteId]);

  useEffect(() => {
    if (titleTouched) return;
    const customerName = customers.find((c) => c.value === customerId)?.label || "";
    const siteName = sites.find((s) => s.value === siteId)?.label || "";
    if (customerName && siteName) setTitle(`${customerName} — ${siteName}`);
    else if (customerName) setTitle(`${customerName} — Estimate`);
    else setTitle("Estimate");
  }, [customerId, siteId, customers, sites, titleTouched]);

  const measurementOptions = useMemo(() => measurementLineOptions(measurements), [measurements]);

  const lineTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity || 0);
        const rate = Number(line.rate || 0);
        if (rate > 0) return sum + qty * rate;
        return sum + Number(line.materialCost || 0) + Number(line.labourCost || 0);
      }, 0),
    [lines],
  );

  function updateLine(id: string, patch: Partial<EstimateLine>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function applyMeasurement(lineId: string, ref: string) {
    const opt = measurementOptions.find((o) => o.value === ref);
    if (!opt) {
      updateLine(lineId, { measurementRef: "" });
      return;
    }
    updateLine(lineId, {
      measurementRef: ref,
      quantity: String(opt.quantity || 0),
      unit: opt.unit || "sqft",
      description: (lines.find((l) => l.id === lineId)?.description || opt.label.split(" · ")[0] || "Measured works").trim(),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!customerId || !siteId) throw new Error("Customer and site are required");
      if (!title.trim()) throw new Error("Title is required");
      if (!lines.length) throw new Error("Add at least one estimate line");
      for (const line of lines) {
        if (!line.description.trim()) throw new Error("Each line needs a description");
        if (!String(line.quantity).trim()) throw new Error("Each line needs a quantity");
      }

      const pct = Number(gstPercent.trim());
      const taxRate =
        gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";

      const estimate = (await athena.estimates.create({
        customerId,
        siteId,
        title,
        validUntil: validUntil || null,
        assumptions: notes || null,
        taxRate,
        items: lines.map((line) => {
          const [measurementId, measurementItemId] = line.measurementRef ? line.measurementRef.split("::") : [null, null];
          return {
            description: line.description,
            quantity: line.quantity,
            unit: line.unit || "sqft",
            materialCost: line.materialCost || "0",
            labourCost: line.labourCost || "0",
            rate: line.rate || null,
            measurementId,
            measurementItemId,
          };
        }),
        measurementId: lines.find((l) => l.measurementRef)?.measurementRef.split("::")[0] || null,
      })) as { id?: string };

      if (estimate.id) {
        const validityDays = validUntil
          ? Math.max(1, Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000))
          : 15;
        await athena.quotes.create({
          estimateId: estimate.id,
          validityDays,
          notes: notes || null,
        });
        router.push(
          entityBackHref({
            customerId,
            tab: "estimates",
            siteId: null,
            siteTab: "estimates",
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const backHref = entityBackHref({
    customerId: presetCustomerId || customerId,
    tab: "estimates",
    siteId: presetSiteId || siteId || null,
    siteTab: "estimates",
  });

  return (
    <div>
      <Link href={backHref} className="text-sm text-clay">
        ← {presetSiteId || siteId ? "Site estimates" : "Back"}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New estimate</h1>
      <p className="mt-1 text-stone-600">Link lines to measurement items to pull calculated quantities.</p>

      <form onSubmit={save} className="mt-6 grid gap-4">
        <div className="grid max-w-4xl gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Customer *</span>
            <select
              className="rounded-xl border px-3 py-2"
              value={customerId}
              required
              disabled={Boolean(presetCustomerId || presetSiteId)}
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
            <select
              className="rounded-xl border px-3 py-2"
              value={siteId}
              required
              disabled={Boolean(presetSiteId) && sites.length <= 1}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">Select…</option>
              {sites.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-stone-700">Title *</span>
            <input
              className="rounded-xl border px-3 py-2"
              value={title}
              required
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Valid Until</span>
            <input className="rounded-xl border px-3 py-2" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">GST % (optional)</span>
            <input
              className="rounded-xl border px-3 py-2"
              inputMode="decimal"
              placeholder="Leave blank for no GST"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </label>
        </div>

        {measurementOptions.length ? (
          <div className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Available measurements</p>
            <ul className="mt-2 grid gap-1 text-stone-700">
              {measurementOptions.map((m) => (
                <li key={m.value}>
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-stone-500">
            No measurements for this customer/site yet. You can still enter quantities manually.
          </p>
        )}

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Estimate lines</h2>
            <button type="button" className="text-sm text-clay" onClick={() => setLines((prev) => [...prev, newLine()])}>
              + Add line
            </button>
          </div>
          {lines.map((line, index) => (
            <div key={line.id} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-stone-800">Line {index + 1}</p>
                {lines.length > 1 ? (
                  <button type="button" className="text-sm text-red-700" onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}>
                    Remove
                  </button>
                ) : null}
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Link measurement item</span>
                <select
                  className="rounded-xl border px-3 py-2"
                  value={line.measurementRef}
                  onChange={(e) => applyMeasurement(line.id, e.target.value)}
                >
                  <option value="">Manual quantity</option>
                  {measurementOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Description *</span>
                <input
                  className="rounded-xl border px-3 py-2"
                  value={line.description}
                  required
                  onChange={(e) => updateLine(line.id, { description: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Quantity *</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    type="number"
                    value={line.quantity}
                    required
                    onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Unit</span>
                  <input className="rounded-xl border px-3 py-2" value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Rate</span>
                  <input className="rounded-xl border px-3 py-2" type="number" value={line.rate} onChange={(e) => updateLine(line.id, { rate: e.target.value })} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Line preview</span>
                  <input
                    className="rounded-xl border bg-stone-50 px-3 py-2"
                    readOnly
                    value={
                      Number(line.rate || 0) > 0
                        ? String(Number(line.quantity || 0) * Number(line.rate || 0))
                        : String(Number(line.materialCost || 0) + Number(line.labourCost || 0))
                    }
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Material cost</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    type="number"
                    value={line.materialCost}
                    onChange={(e) => updateLine(line.id, { materialCost: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Labour cost</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    type="number"
                    value={line.labourCost}
                    onChange={(e) => updateLine(line.id, { labourCost: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <label className="grid max-w-3xl gap-1 text-sm">
          <span className="font-medium text-stone-700">Assumptions / notes</span>
          <textarea className="rounded-xl border px-3 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <p className="text-sm text-stone-700">
          Lines preview total: {lineTotal.toFixed(2)}
          {gstPercent.trim() && Number(gstPercent) > 0
            ? ` · with GST ${gstPercent}% ≈ ${(lineTotal * (1 + Number(gstPercent) / 100)).toFixed(2)}`
            : " · no GST"}
        </p>
        {error ? <ErrorState message={error} /> : null}
        <button type="submit" disabled={busy} className="w-fit rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save estimate"}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <NewEstimateForm />
    </Suspense>
  );
}
