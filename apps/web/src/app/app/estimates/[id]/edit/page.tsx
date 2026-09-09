"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

type EstimateLine = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  materialCost: string;
  labourCost: string;
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
  };
}

function lineFromApi(item: Record<string, unknown>, idx: number): EstimateLine {
  return {
    id: `el-${idx}-${String(item.id || idx)}`,
    description: String(item.description || ""),
    quantity: String(item.quantity || "1"),
    unit: String(item.unit || "sqft"),
    materialCost: String(item.materialCost || "0"),
    labourCost: String(item.labourCost || "0"),
    rate: item.rate != null ? String(item.rate) : "",
  };
}

function EditEstimateForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Record<string, unknown> | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<EstimateLine[]>([newLine()]);
  const [materials, setMaterials] = useState<
    Array<{ value: string; label: string; unit?: string; purchase?: string; selling?: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const est = await athena.estimates.get(id);
    setEstimate(est);
    setTitle(String(est.title || ""));
    setNotes(String(est.assumptions || ""));
    const taxRate = Number(est.taxRate || 0);
    setGstPercent(taxRate > 0 ? String(taxRate * 100) : "");
    const items = (est.items as Array<Record<string, unknown>>) || [];
    setLines(items.length ? items.map(lineFromApi) : [newLine()]);
    if (est.customerId) {
      const c = await athena.customers.get(String(est.customerId)).catch(() => null);
      setCustomerName(String(c?.name || est.customerId));
    }
    if (est.siteId) {
      const s = await athena.sites.get(String(est.siteId)).catch(() => null);
      setSiteName(String(s?.name || est.siteId));
    }
  }, [id]);

  useEffect(() => {
    athena.materials
      .list()
      .then((res) =>
        setMaterials(
          (res.items || []).map((m) => ({
            value: String(m.id),
            label: String(m.name || m.sku || m.id),
            unit: m.unit ? String(m.unit) : undefined,
            purchase: m.defaultPurchasePrice ? String(m.defaultPurchasePrice) : undefined,
            selling: m.defaultSellingPrice ? String(m.defaultSellingPrice) : undefined,
          })),
        ),
      )
      .catch(() => setMaterials([]));
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

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

  function updateLine(lineId: string, patch: Partial<EstimateLine>) {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function applyMaterial(lineId: string, materialId: string) {
    const match = materials.find((m) => m.value === materialId);
    if (!match) return;
    updateLine(lineId, {
      description: match.label,
      ...(match.unit ? { unit: match.unit } : {}),
      ...(match.purchase ? { materialCost: match.purchase } : {}),
      ...(match.selling ? { rate: match.selling } : {}),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!estimate) return;
    setBusy(true);
    setError(null);
    try {
      if (!title.trim()) throw new Error("Title is required");
      if (!lines.length) throw new Error("Add at least one estimate line");
      for (const line of lines) {
        if (!line.description.trim()) throw new Error("Each line needs a description");
        if (!String(line.quantity).trim()) throw new Error("Each line needs a quantity");
      }

      const pct = Number(gstPercent.trim());
      const taxRate = gstPercent.trim() && Number.isFinite(pct) && pct > 0 ? String(pct / 100) : "0";

      await athena.estimates.revise(id, {
        customerId: String(estimate.customerId),
        siteId: String(estimate.siteId),
        title,
        assumptions: notes || null,
        taxRate,
        items: lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unit: line.unit || "sqft",
          materialCost: line.materialCost || "0",
          labourCost: line.labourCost || "0",
          rate: line.rate || null,
        })),
      });
      router.push(`/app/estimates/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-stone-600">Loading…</p>;
  if (error && !estimate) return <ErrorState message={error} />;

  return (
    <div>
      <Link href={`/app/estimates/${id}`} className="text-sm text-clay">
        ← Estimate
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit estimate</h1>
      <p className="mt-1 text-stone-600">
        {customerName && siteName ? `${customerName} · ${siteName}` : "Customer and site are locked."}
      </p>

      <form onSubmit={save} className="mt-6 grid gap-4">
        <div className="grid max-w-4xl gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Customer</span>
            <input className="rounded-xl border bg-stone-50 px-3 py-2" value={customerName} readOnly />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Site</span>
            <input className="rounded-xl border bg-stone-50 px-3 py-2" value={siteName} readOnly />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-stone-700">Title *</span>
            <input className="rounded-xl border px-3 py-2" value={title} required onChange={(e) => setTitle(e.target.value)} />
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
                <span className="font-medium text-stone-700">Material from catalog</span>
                <select
                  className="rounded-xl border px-3 py-2"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) applyMaterial(line.id, e.target.value);
                  }}
                >
                  <option value="">
                    {materials.length ? "Select a material (fills description & costs)" : "No materials in catalog yet"}
                  </option>
                  {materials.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
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

        <p className="text-sm text-stone-700">Lines preview total: {lineTotal.toFixed(2)}</p>
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
      <EditEstimateForm />
    </Suspense>
  );
}
