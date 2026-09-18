"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatQty } from "@/lib/name-maps";

type Tab = "overview" | "measurements" | "inventory" | "expenses" | "gstr1" | "gstr2b";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "measurements", label: "Measurements" },
  { id: "inventory", label: "Inventory" },
  { id: "expenses", label: "Daily expenses" },
  { id: "gstr1", label: "GSTR-1" },
  { id: "gstr2b", label: "GSTR-2B" },
];

export default function Page() {
  const [tab, setTab] = useState<Tab>("overview");
  const [accounts, setAccounts] = useState<Record<string, unknown> | null>(null);
  const [gst, setGst] = useState<Record<string, unknown> | null>(null);
  const [attendance, setAttendance] = useState<Record<string, unknown>[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, unknown> | null>(null);
  const [inventory, setInventory] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown> | null>(null);
  const [gstr1, setGstr1] = useState<Record<string, unknown>[]>([]);
  const [gstr2b, setGstr2b] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([athena.accounts(), athena.gst(), athena.attendance.list()])
      .then(([a, g, att]) => {
        setAccounts(a as Record<string, unknown>);
        setGst(g as Record<string, unknown>);
        setAttendance(att.items || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    if (tab === "measurements" && !measurements) {
      athena.reports.measurements().then(setMeasurements).catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }
    if (tab === "inventory" && !inventory.length) {
      athena.reports
        .inventory()
        .then((r) => setInventory(r.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }
    if (tab === "expenses" && !expenses) {
      athena.reports.dailyExpenses().then(setExpenses).catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }
    if (tab === "gstr1" && !gstr1.length) {
      athena.reports
        .gstr1()
        .then((r) => setGstr1(r.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }
    if (tab === "gstr2b" && !gstr2b.length) {
      athena.reports
        .gstr2b()
        .then((r) => setGstr2b(r.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }
  }, [tab, measurements, inventory.length, expenses, gstr1.length, gstr2b.length]);

  if (error && !accounts) return <ErrorState message={error} />;
  if (!accounts) return <p className="text-stone-600">Loading…</p>;

  const summary = (accounts.summary as Record<string, unknown>) || accounts;
  const present = attendance.filter((a) => String(a.status) === "present" || String(a.status) === "half_day").length;
  const absent = attendance.filter((a) => String(a.status) === "absent").length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="mt-1 text-stone-600">Accounts, stock, daily expenses, and GST list views.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
              tab === t.id ? "bg-clay text-white" : "border border-stone-200 bg-white text-stone-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {tab === "overview" ? (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-400">Accounts</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Approved estimates", summary.approvedEstimates ?? summary.approvedEstimateValue],
              ["Collected", summary.collected ?? summary.collections],
              ["Outstanding", summary.outstanding],
              ["Billed", summary.billed],
              ["Expenses", summary.expenses],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-stone-500">{String(label)}</p>
                <p className="mt-1 text-xl font-semibold">
                  {typeof value === "number" || (typeof value === "string" && /^\d/.test(value))
                    ? formatCurrency(String(value ?? 0))
                    : String(value ?? "—")}
                </p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-400">GST summary</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["Output tax", gst?.outputTax],
              ["Input tax", gst?.inputTax],
              ["Net", gst?.net],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border-l-4 border-l-amber-600 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-stone-500">{String(label)}</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(String(value ?? 0))}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-stone-500">
            Open <button type="button" className="font-semibold text-clay" onClick={() => setTab("gstr1")}>GSTR-1</button> /{" "}
            <button type="button" className="font-semibold text-clay" onClick={() => setTab("gstr2b")}>GSTR-2B</button> for line lists
            (filing out of scope).
          </p>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-400">Attendance</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-stone-500">Records</p>
              <p className="mt-1 text-xl font-semibold">{attendance.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-stone-500">Present / half</p>
              <p className="mt-1 text-xl font-semibold">{present}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-stone-500">Absent</p>
              <p className="mt-1 text-xl font-semibold">{absent}</p>
            </div>
          </div>
          <p className="mt-4 text-sm">
            <Link href="/app/stock" className="font-semibold text-clay">
              View stock ledger →
            </Link>
          </p>
        </>
      ) : null}

      {tab === "measurements" ? (
        <div className="mt-6">
          {!measurements ? (
            <p className="text-stone-600">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-stone-600">{String(measurements.total ?? 0)} measurement records</p>
              <ul className="mt-3 grid gap-3">
                {((measurements.items as Record<string, unknown>[]) || []).map((site) => (
                  <li key={String(site.siteId || site.siteName)} className="rounded-2xl border bg-white p-4 shadow-sm">
                    <p className="font-semibold">{String(site.siteName || "Unassigned")}</p>
                    <p className="text-sm text-stone-600">{String(site.count)} records</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {tab === "inventory" ? (
        <div className="mt-6">
          {!inventory.length ? (
            <p className="text-stone-600">No stock rows yet.</p>
          ) : (
            <ul className="grid gap-2">
              {inventory.map((row) => (
                <li key={String(row.id)} className="flex justify-between rounded-xl border bg-white px-4 py-3 text-sm">
                  <span className="font-medium">
                    {String(row.toolName || row.name)}
                    {row.lowStock ? <span className="ml-2 text-amber-700">Low</span> : null}
                  </span>
                  <span className="text-stone-600">
                    {formatQty(row.onHand ?? row.qty)} {String(row.unit || "")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "expenses" ? (
        <div className="mt-6">
          {!expenses ? (
            <p className="text-stone-600">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-stone-600">Grand total {formatCurrency(String(expenses.grandTotal || 0))}</p>
              <ul className="mt-3 grid gap-3">
                {((expenses.items as Record<string, unknown>[]) || []).map((day) => (
                  <li key={String(day.date)} className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold">{formatDate(String(day.date))}</p>
                      <p className="font-semibold">{formatCurrency(String(day.total || 0))}</p>
                    </div>
                    <p className="text-sm text-stone-600">{String(day.count)} expense(s)</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {tab === "gstr1" ? (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Taxable</th>
                <th className="px-3 py-2">Tax</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {gstr1.map((row) => (
                <tr key={String(row.id)} className="border-b border-stone-100">
                  <td className="px-3 py-2 font-medium">{String(row.number || row.id)}</td>
                  <td className="px-3 py-2">{row.date ? formatDate(String(row.date)) : "—"}</td>
                  <td className="px-3 py-2">{String(row.customerName || "—")}</td>
                  <td className="px-3 py-2">{formatCurrency(String(row.taxableAmount || 0))}</td>
                  <td className="px-3 py-2">{formatCurrency(String(row.taxTotal || 0))}</td>
                  <td className="px-3 py-2">{formatCurrency(String(row.grandTotal || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!gstr1.length ? <p className="mt-3 text-stone-600">No outward invoices yet.</p> : null}
        </div>
      ) : null}

      {tab === "gstr2b" ? (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Purchase</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Taxable</th>
                <th className="px-3 py-2">Tax</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {gstr2b.map((row) => (
                <tr key={String(row.id)} className="border-b border-stone-100">
                  <td className="px-3 py-2 font-medium">{String(row.invoiceNumber || row.id)}</td>
                  <td className="px-3 py-2">{row.date ? formatDate(String(row.date)) : "—"}</td>
                  <td className="px-3 py-2">{String(row.supplier || "—")}</td>
                  <td className="px-3 py-2">{formatCurrency(String(row.taxableAmount || 0))}</td>
                  <td className="px-3 py-2">{formatCurrency(String(row.taxTotal || 0))}</td>
                  <td className="px-3 py-2">{formatCurrency(String(row.grandTotal || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!gstr2b.length ? <p className="mt-3 text-stone-600">No purchases yet.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
