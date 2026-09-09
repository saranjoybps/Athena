"use client";

import { useEffect, useState } from "react";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { formatCurrency } from "@/lib/format";

export default function Page() {
  const [accounts, setAccounts] = useState<Record<string, unknown> | null>(null);
  const [attendance, setAttendance] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([athena.accounts(), athena.attendance.list()])
      .then(([a, att]) => {
        setAccounts(a as Record<string, unknown>);
        setAttendance(att.items || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!accounts) return <p className="text-stone-600">Loading…</p>;

  const summary = (accounts.summary as Record<string, unknown>) || accounts;
  const present = attendance.filter((a) => String(a.status) === "present" || String(a.status) === "half_day").length;
  const absent = attendance.filter((a) => String(a.status) === "absent").length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="mt-1 text-stone-600">Accounts snapshot and attendance summary.</p>

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
    </div>
  );
}
