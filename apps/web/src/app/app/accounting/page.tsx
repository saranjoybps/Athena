"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/states";
import { RecordLink } from "@/components/record-link";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

type Tab = "overview" | "receivables" | "ledger" | "activity";

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [gst, setGst] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [accounts, gstSummary] = await Promise.all([athena.accounts(), athena.gst().catch(() => null)]);
    setData(accounts);
    setGst(gstSummary);
    return accounts;
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  if (error && !data) return <ErrorState message={error} />;
  if (!data) return <p className="text-stone-600">Loading…</p>;

  const pl = (data.pl || {}) as Record<string, string>;
  const counts = (data.counts || {}) as Record<string, number>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <p className="mt-1 text-stone-600">Collections, receivables, expenses, and ledger — tied to invoices and payments.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Collections" value={formatCurrency(pl.collections)} />
        <Stat label="Outstanding AR" value={formatCurrency(pl.outstanding)} />
        <Stat label="Costs" value={formatCurrency(pl.costs)} />
        <Stat label="Net (collections − costs)" value={formatCurrency(pl.net)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {(
          [
            ["overview", "Overview"],
            ["receivables", `Receivables (${counts.openInvoices || 0})`],
            ["ledger", "Ledger"],
            ["activity", "Activity"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-clay text-white" : "bg-white text-stone-700 shadow-sm"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" ? <Overview data={data} gst={gst} /> : null}
        {tab === "receivables" ? <Receivables data={data} /> : null}
        {tab === "ledger" ? <Ledger data={data} /> : null}
        {tab === "activity" ? <Activity data={data} /> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Overview({ data, gst }: { data: Record<string, unknown>; gst: Record<string, unknown> | null }) {
  const pl = (data.pl || {}) as Record<string, string>;
  const balances = (data.customerBalances as Record<string, unknown>[]) || [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">P&amp;L snapshot</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <Row label="Billed" value={formatCurrency(pl.billed)} />
          <Row label="Collected" value={formatCurrency(pl.collections)} />
          <Row label="Outstanding" value={formatCurrency(pl.outstanding)} />
          <Row label="Expenses" value={formatCurrency(pl.expenses)} />
          <Row label="Purchases" value={formatCurrency(pl.purchases)} />
          <Row label="Net" value={formatCurrency(pl.net)} strong />
        </dl>
        {gst ? (
          <div className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-600">
            GST output {formatCurrency(String(gst.outputTax))} · input {formatCurrency(String(gst.inputTax))} · net{" "}
            {formatCurrency(String(gst.net))}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/app/invoices" className="text-clay">
            Invoices →
          </Link>
          <Link href="/app/payments/new" className="text-clay">
            Record payment →
          </Link>
          <Link href="/app/expenses/new" className="text-clay">
            Add expense →
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">AR by customer</h2>
        <div className="grid gap-2">
          {balances.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">No outstanding receivables.</p>
          ) : null}
          {balances.slice(0, 8).map((b) => (
            <RecordLink
              key={String(b.customerId || b.customerName)}
              href={b.customerId ? `/app/customers/${b.customerId}` : "/app/customers"}
              title={String(b.customerName || "Customer")}
              subtitle={`${b.invoiceCount} open · ${formatCurrency(String(b.outstanding))}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Receivables({ data }: { data: Record<string, unknown> }) {
  const rows = (data.receivables as Record<string, unknown>[]) || [];
  return (
    <div className="grid gap-2">
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">All caught up — no open invoices.</p>
      ) : null}
      {rows.map((r) => (
        <div key={String(r.invoiceId)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Link href={`/app/invoices/${r.invoiceId}`} className="font-medium text-clay">
              {String(r.number || r.invoiceId)}
            </Link>
            <p className="text-sm text-stone-600">
              {r.customerId ? (
                <Link href={`/app/customers/${r.customerId}`} className="text-clay">
                  {String(r.customerName || "Customer")}
                </Link>
              ) : (
                "—"
              )}{" "}
              · {formatCurrency(String(r.outstanding))} outstanding of {formatCurrency(String(r.total))}
            </p>
          </div>
          <Link
            href={`/app/payments/new?invoiceId=${r.invoiceId}`}
            className="rounded-xl bg-clay px-3 py-1.5 text-sm text-white"
          >
            Record payment
          </Link>
        </div>
      ))}
    </div>
  );
}

function Ledger({ data }: { data: Record<string, unknown> }) {
  const rows = (data.ledger as Record<string, unknown>[]) || [];
  return (
    <div className="grid gap-2">
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">No ledger entries yet.</p>
      ) : null}
      {rows.map((e) => {
        const href = ledgerHref(String(e.reference || ""), String(e.referenceId || ""));
        return (
          <div key={String(e.id)} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium capitalize">{String(e.type || "entry")}</p>
                <p className="text-sm text-stone-600">
                  {formatCurrency(String(e.amount || "0"))}
                  {e.notes ? ` · ${e.notes}` : ""}
                </p>
                <p className="mt-1 text-xs text-stone-500">{formatDate(String(e.postedAt || ""))}</p>
              </div>
              {href ? (
                <Link href={href} className="text-sm text-clay">
                  Open source →
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Activity({ data }: { data: Record<string, unknown> }) {
  const payments = (data.recentPayments as Record<string, unknown>[]) || [];
  const expenses = (data.recentExpenses as Record<string, unknown>[]) || [];
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Recent payments</h2>
        <div className="grid gap-2">
          {payments.length === 0 ? <p className="text-sm text-stone-500">None yet.</p> : null}
          {payments.map((p) => (
            <div key={String(p.id)} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">
                {formatCurrency(String(p.amount))} · {String(p.method || "")}
              </p>
              <p className="text-sm text-stone-600">
                {p.invoiceId ? (
                  <Link href={`/app/invoices/${p.invoiceId}`} className="text-clay">
                    Invoice
                  </Link>
                ) : null}
                {p.customerId ? (
                  <>
                    {" · "}
                    <Link href={`/app/customers/${p.customerId}`} className="text-clay">
                      Customer
                    </Link>
                  </>
                ) : null}
                {" · "}
                {formatDate(String(p.createdAt || ""))}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Recent expenses</h2>
        <div className="grid gap-2">
          {expenses.length === 0 ? <p className="text-sm text-stone-500">None yet.</p> : null}
          {expenses.map((e) => (
            <RecordLink
              key={String(e.id)}
              href={`/app/expenses/${e.id}`}
              title={`${formatCurrency(String(e.amount))} · ${String(e.category || "expense")}`}
              subtitle={String(e.description || "")}
              meta={formatDate(String(e.createdAt || ""))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}

function ledgerHref(reference: string, referenceId: string): string | null {
  if (!referenceId) return null;
  const ref = reference.toLowerCase();
  if (ref.includes("invoice")) return `/app/invoices/${referenceId}`;
  if (ref.includes("payment")) return `/app/payments`;
  if (ref.includes("expense")) return `/app/expenses/${referenceId}`;
  if (ref.includes("purchase")) return `/app/procurement`;
  return null;
}
