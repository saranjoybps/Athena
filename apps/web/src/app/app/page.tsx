"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { athena } from "@/lib/athena-client";
import { PageHeader } from "@/components/states";

const MODULES = [
  { href: "/app/invoices", label: "Invoices", hint: "Bill & collect" },
  { href: "/app/quotes", label: "Estimates", hint: "Send & approve" },
  { href: "/app/customers", label: "Customers", hint: "Sites & measurements" },
  { href: "/app/projects", label: "Projects", hint: "Active jobs" },
  { href: "/app/materials", label: "Inventory", hint: "Materials & tools" },
  { href: "/app/expenses", label: "Expenses", hint: "Site spend" },
  { href: "/app/reports", label: "Reports", hint: "GST · P&L · stock" },
  { href: "/app/delivery-challans", label: "Delivery challans", hint: "Outbound DC" },
] as const;

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
    { title: "Pending estimates", value: stats?.pendingQuotations ?? "—" },
    { title: "Collections", value: stats?.collections ? `₹${stats.collections}` : "—" },
    { title: "Outstanding", value: stats?.outstanding ? `₹${stats.outstanding}` : "—" },
    { title: "Expenses", value: stats?.expenses ? `₹${stats.expenses}` : "—" },
    { title: "Projects at risk", value: stats?.projectsAtRisk ?? "—" },
  ];

  return (
    <>
      <PageHeader title="Owner dashboard" subtitle="Shortcuts and live operational metrics." />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Modules</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-clay/40 hover:bg-sand"
          >
            <p className="font-semibold text-ink">{m.label}</p>
            <p className="mt-1 text-sm text-stone-500">{m.hint}</p>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Metrics</h2>
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
