"use client";

import { useEffect, useState } from "react";
import { athena } from "@/lib/athena-client";
import { PageHeader } from "@/components/states";

export default function AppHome() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    athena
      .dashboard()
      .then((d) => setStats(d as Record<string, unknown>))
      .catch(() => setStats(null));
  }, []);

  const cards = [
    { title: "Active projects", value: stats?.activeProjects ?? "—" },
    { title: "Pending quotes", value: stats?.pendingQuotations ?? "—" },
    { title: "Collections", value: stats?.collections ? `₹${stats.collections}` : "—" },
    { title: "Outstanding", value: stats?.outstanding ? `₹${stats.outstanding}` : "—" },
    { title: "Expenses", value: stats?.expenses ? `₹${stats.expenses}` : "—" },
    { title: "Projects at risk", value: stats?.projectsAtRisk ?? "—" },
  ];

  return (
    <>
      <PageHeader title="Owner dashboard" subtitle="Operational metrics from live project data." />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-600">{c.title}</p>
            <p className="mt-2 text-2xl font-semibold">{String(c.value)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
