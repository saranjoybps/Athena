"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/states";

type Props = {
  title: string;
  subtitle?: string;
  createHref?: string;
  createLabel?: string;
  load: () => Promise<{ items: Array<Record<string, unknown>> }>;
  render: (item: Record<string, unknown>) => React.ReactNode;
};

export function DataPage({ title, subtitle, createHref, createLabel, load, render }: Props) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load()
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-stone-600">{subtitle}</p> : null}
        </div>
        {createHref && createLabel ? (
          <Link href={createHref} className="rounded-xl bg-clay px-4 py-2 text-white text-sm">
            {createLabel}
          </Link>
        ) : null}
      </div>
      {loading ? <p className="text-stone-600">Loading…</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-stone-600">No records yet.</p>
      ) : null}
      <div className="grid gap-3">{items.map((item) => render(item))}</div>
    </div>
  );
}
