"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

type LabourOpt = { id: string; name: string };

function memberIdsFromCrew(members: unknown): string[] {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => {
      if (!m || typeof m !== "object") return "";
      const row = m as Record<string, unknown>;
      return String(row.labourId || row.workerId || "");
    })
    .filter(Boolean);
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [dailyCost, setDailyCost] = useState("");
  const [expectedProductivity, setExpectedProductivity] = useState("");
  const [workers, setWorkers] = useState<LabourOpt[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [crew, labourRes] = await Promise.all([athena.crews.get(id), athena.labour.list()]);
    setName(String(crew.name || ""));
    setTrade(String(crew.trade || ""));
    setDailyCost(String(crew.dailyCost || ""));
    setExpectedProductivity(String(crew.expectedProductivity || ""));
    setSelected(memberIdsFromCrew(crew.members));
    setWorkers(
      (labourRes.items || []).map((w) => ({
        id: String(w.id),
        name: String(w.name || w.id),
      })),
    );
  }, [id]);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  function toggle(workerId: string) {
    setSelected((prev) => (prev.includes(workerId) ? prev.filter((x) => x !== workerId) : [...prev, workerId]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Crew name is required");
      await athena.crews.update(id, {
        name: name.trim(),
        trade: trade.trim() || null,
        dailyCost: dailyCost.trim() || null,
        expectedProductivity: expectedProductivity.trim() || null,
        members: selected.map((labourId) => ({ labourId })),
      });
      router.push("/app/crews");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-stone-600">Loading…</p>;
  if (error && !name) return <ErrorState message={error} />;

  return (
    <div>
      <Link href="/app/crews" className="text-sm text-clay">
        ← Crews
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit crew</h1>
      <p className="mt-1 text-stone-600">Update crew details and labour roster.</p>

      <form onSubmit={save} className="mt-6 grid max-w-xl gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Crew name *</span>
          <input className="rounded-xl border px-3 py-2" value={name} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Trade</span>
          <input className="rounded-xl border px-3 py-2" value={trade} onChange={(e) => setTrade(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Daily cost</span>
          <input
            className="rounded-xl border px-3 py-2"
            type="number"
            value={dailyCost}
            onChange={(e) => setDailyCost(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Expected productivity</span>
          <input
            className="rounded-xl border px-3 py-2"
            value={expectedProductivity}
            onChange={(e) => setExpectedProductivity(e.target.value)}
          />
        </label>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-stone-700">Labour members</p>
          <p className="text-xs text-stone-500">Toggle workers to attach or remove them from this crew.</p>
          {workers.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-stone-500">No labour workers yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {workers.map((w) => {
                const on = selected.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggle(w.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      on ? "border-clay bg-clay/10 font-semibold text-clay" : "border-stone-200 bg-white text-stone-600"
                    }`}
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-stone-500">
            {selected.length} worker{selected.length === 1 ? "" : "s"} on roster
          </p>
        </div>

        {error ? <ErrorState message={error} /> : null}
        <button type="submit" disabled={busy} className="w-fit rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
