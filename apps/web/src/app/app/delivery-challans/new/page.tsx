"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentFormChrome, DocSection } from "@/components/document-form-chrome";
import { athena, optionsFrom } from "@/lib/athena-client";

type Line = { id: string; description: string; quantity: string; unit: string };

function newId() {
  return `dc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export default function Page() {
  const router = useRouter();
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([]);
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ id: newId(), description: "", quantity: "1", unit: "pcs" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([optionsFrom(athena.customers.list, ["name"]), optionsFrom(athena.projects.list, ["name", "number"])])
      .then(([c, p]) => {
        setCustomers(c);
        setProjects(p);
      })
      .catch(() => undefined);
  }, []);

  const canSave = useMemo(
    () => Boolean(customerId && lines.some((l) => l.description.trim())),
    [customerId, lines],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const doc = (await athena.deliveryChallans.create({
        customerId,
        projectId: projectId || null,
        date,
        vehicleNumber: vehicleNumber || null,
        receiverName: receiverName || null,
        notes: notes || null,
        items: lines
          .filter((l) => l.description.trim())
          .map((l) => ({
            description: l.description.trim(),
            quantity: l.quantity || "1",
            unit: l.unit || "pcs",
          })),
        status: "draft",
      })) as { id?: string };
      router.push(doc.id ? `/app/delivery-challans/${doc.id}` : "/app/delivery-challans");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create challan");
      setBusy(false);
    }
  }

  return (
    <DocumentFormChrome
      title="New delivery challan"
      subtitle="Outbound delivery note — customer, vehicle, lines, optional receiver."
      backHref="/app/delivery-challans"
      backLabel="Delivery challans"
      accent="green"
      footer={
        <button
          type="submit"
          form="dc-create-form"
          disabled={busy || !canSave}
          className="rounded-xl bg-clay px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save draft"}
        </button>
      }
    >
      <form id="dc-create-form" onSubmit={submit} className="grid gap-2">
        {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <DocSection title="Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Customer *</span>
              <select className="rounded-xl border px-3 py-2" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Project</span>
              <select className="rounded-xl border px-3 py-2" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Optional…</option>
                {projects.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Date *</span>
              <input className="rounded-xl border px-3 py-2" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">Vehicle number</span>
              <input className="rounded-xl border px-3 py-2" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA-01-AB-1234" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-stone-700">Receiver name</span>
              <input className="rounded-xl border px-3 py-2" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-stone-700">Notes</span>
              <textarea className="rounded-xl border px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </DocSection>

        <DocSection title="Line items">
          <ul className="grid gap-3">
            {lines.map((line, idx) => (
              <li key={line.id} className="grid gap-3 rounded-2xl border bg-sand/30 p-4 sm:grid-cols-[1fr_100px_100px_auto]">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Description {idx + 1}</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    value={line.description}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, description: e.target.value } : l)))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Qty</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    type="number"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, quantity: e.target.value } : l)))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Unit</span>
                  <input
                    className="rounded-xl border px-3 py-2"
                    value={line.unit}
                    onChange={(e) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, unit: e.target.value } : l)))}
                  />
                </label>
                <button
                  type="button"
                  className="self-end text-sm text-red-700"
                  onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== line.id) : prev))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-clay"
            onClick={() => setLines((prev) => [...prev, { id: newId(), description: "", quantity: "1", unit: "pcs" }])}
          >
            + Add line
          </button>
        </DocSection>
      </form>
    </DocumentFormChrome>
  );
}
