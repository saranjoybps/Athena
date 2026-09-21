"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

type LabourOpt = { id: string; name: string };

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [dailyCost, setDailyCost] = useState("");
  const [workers, setWorkers] = useState<LabourOpt[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    athena.labour
      .list()
      .then((res) =>
        setWorkers(
          (res.items || []).map((w) => ({
            id: String(w.id),
            name: String(w.name || w.id),
          })),
        ),
      )
      .catch(() => setWorkers([]));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Crew name is required");
      if (!dailyCost.trim()) throw new Error("Daily wages / cost is required");
      await athena.crews.create({
        name: name.trim(),
        trade: trade.trim() || null,
        dailyCost: dailyCost.trim(),
        members: selected.map((labourId) => ({ labourId })),
      });
      router.push("/app/crews");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href="/app/crews" className="text-sm text-clay">
        ← Crews
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New crew</h1>
      <p className="mt-1 text-stone-600">Name the crew and attach labour workers to its roster.</p>

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
          <span className="font-medium text-stone-700">Daily wages / cost *</span>
          <input
            className="rounded-xl border px-3 py-2"
            type="number"
            value={dailyCost}
            required
            onChange={(e) => setDailyCost(e.target.value)}
          />
        </label>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-stone-700">Labour members</p>
          <p className="text-xs text-stone-500">Select one or more workers to attach to this crew.</p>
          {workers.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-stone-500">
              No labour workers yet — add workers under Labour first.
            </p>
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
          {selected.length ? (
            <p className="text-xs text-stone-500">{selected.length} worker{selected.length === 1 ? "" : "s"} selected</p>
          ) : null}
        </div>

        {error ? <ErrorState message={error} /> : null}
        <button type="submit" disabled={busy} className="w-fit rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save crew"}
        </button>
      </form>
    </div>
  );
}
