"use client";

import { useEffect, useState } from "react";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    athena
      .dashboard()
      .then((d) => setData(d as Record<string, unknown>))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <p className="text-stone-600">Loading…</p>;

  const entries = Object.entries(data).filter(([, v]) => v !== null && typeof v !== "object");
  const nested = Object.entries(data).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="mt-1 text-stone-600">Operational snapshot from the dashboard API.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-stone-500">{k}</p>
            <p className="mt-1 text-xl font-semibold">{String(v)}</p>
          </div>
        ))}
        {nested.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-stone-500">{k}</p>
            <pre className="mt-2 overflow-auto text-xs text-stone-700">{JSON.stringify(v, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
