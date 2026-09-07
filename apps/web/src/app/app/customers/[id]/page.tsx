"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { ErrorState } from "@/components/states";
import { RecordLink } from "@/components/record-link";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

type Tab = "overview" | "pipeline" | "money" | "followups" | "details";

type Brief = Record<string, unknown> & { id?: string };

export default function CustomerHubPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return athena.customers.summary(id).then((s) => {
      setSummary(s);
      return s;
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  if (error && !summary) return <ErrorState message={error} />;
  if (!summary) return <p className="text-stone-600">Loading…</p>;

  const customer = (summary.customer || {}) as Record<string, unknown>;
  const money = (summary.money || {}) as Record<string, string>;
  const counts = (summary.counts || {}) as Record<string, number>;
  const name = String(customer.name || "Customer");

  return (
    <div>
      <Link href="/app/customers" className="text-sm text-clay">
        ← Customers
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="mt-1 text-stone-600">
            {[customer.phone, customer.email, customer.company].filter(Boolean).map(String).join(" · ") || "CRM hub"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/sites/new?customerId=${id}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
            Add site
          </Link>
          <Link href={`/app/estimates/new?customerId=${id}`} className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
            New estimate
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatCurrency(money.outstanding)} />
        <Stat label="Collected" value={formatCurrency(money.collected)} />
        <Stat label="Billed" value={formatCurrency(money.billed)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {(
          [
            ["overview", "Overview"],
            ["pipeline", "Pipeline"],
            ["money", "Money"],
            ["followups", "Follow-ups"],
            ["details", "Details"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-clay text-white" : "bg-white text-stone-700 shadow-sm"}`}
          >
            {label}
            {key === "followups" && counts.openFollowUps ? ` (${counts.openFollowUps})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" ? <Overview summary={summary} customerId={id} onRefresh={load} /> : null}
        {tab === "pipeline" ? <Pipeline summary={summary} customerId={id} /> : null}
        {tab === "money" ? <Money summary={summary} customerId={id} /> : null}
        {tab === "followups" ? <FollowUps customerId={id} items={(summary.followUps as Brief[]) || []} onRefresh={load} /> : null}
        {tab === "details" ? <CustomerDetails id={id} onSaved={load} /> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function Overview({
  summary,
  customerId,
  onRefresh,
}: {
  summary: Record<string, unknown>;
  customerId: string;
  onRefresh: () => Promise<unknown>;
}) {
  const counts = (summary.counts || {}) as Record<string, number>;
  const followUps = ((summary.followUps as Brief[]) || []).slice(0, 3);
  const sites = ((summary.sites as Brief[]) || []).slice(0, 4);
  const projects = ((summary.projects as Brief[]) || []).slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">At a glance</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Sites", counts.sites],
            ["Quotes", counts.quotes],
            ["Projects", counts.projects],
            ["Invoices", counts.invoices],
          ].map(([label, n]) => (
            <div key={String(label)} className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-lg font-semibold">{n ?? 0}</p>
              <p className="text-xs text-stone-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/app/sites/new?customerId=${customerId}`} className="text-sm text-clay">
            + Site
          </Link>
          <Link href={`/app/quotes/new?customerId=${customerId}`} className="text-sm text-clay">
            + Quote path
          </Link>
          <Link href={`/app/invoices/new?customerId=${customerId}`} className="text-sm text-clay">
            + Invoice
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Open follow-ups</h2>
          <button type="button" className="text-sm text-clay" onClick={() => onRefresh()}>
            Refresh
          </button>
        </div>
        {followUps.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">No open follow-ups.</p>
        ) : (
          <div className="grid gap-2">
            {followUps.map((f) => (
              <div key={String(f.id)} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-medium">{String(f.note)}</p>
                <p className="text-xs text-stone-500">Due {formatDate(String(f.dueAt || ""))}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Sites</h2>
        <div className="grid gap-2">
          {sites.length === 0 ? <Empty>No sites yet.</Empty> : null}
          {sites.map((s) => (
            <RecordLink
              key={String(s.id)}
              href={`/app/sites/${s.id}`}
              title={String(s.name || s.id)}
              subtitle={String(s.address || "")}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Projects</h2>
        <div className="grid gap-2">
          {projects.length === 0 ? <Empty>No projects yet.</Empty> : null}
          {projects.map((p) => (
            <RecordLink
              key={String(p.id)}
              href={`/app/projects/${p.id}`}
              title={String(p.name || p.number || p.id)}
              subtitle={formatCurrency(String(p.contractValue || "0"))}
              status={p.status ? String(p.status) : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Pipeline({ summary, customerId }: { summary: Record<string, unknown>; customerId: string }) {
  const sites = (summary.sites as Brief[]) || [];
  const surveys = (summary.surveys as Brief[]) || [];
  const estimates = (summary.estimates as Brief[]) || [];
  const quotes = (summary.quotes as Brief[]) || [];
  const projects = (summary.projects as Brief[]) || [];

  return (
    <div className="grid gap-8">
      <PipelineSection
        title="Sites"
        actionHref={`/app/sites/new?customerId=${customerId}`}
        actionLabel="Add site"
        empty="No sites."
        items={sites.map((s) => (
          <RecordLink
            key={String(s.id)}
            href={`/app/sites/${s.id}`}
            title={String(s.name || s.id)}
            subtitle={String(s.address || "")}
          />
        ))}
      />
      <PipelineSection
        title="Surveys"
        empty="Surveys are created from a site."
        items={surveys.map((s) => (
          <RecordLink
            key={String(s.id)}
            href={s.siteId ? `/app/sites/${s.siteId}` : `/app/customers/${customerId}`}
            title={String(s.number || s.projectType || s.id)}
            subtitle={String(s.scope || "")}
            meta={formatDate(String(s.createdAt || ""))}
          />
        ))}
      />
      <PipelineSection
        title="Estimates"
        actionHref={`/app/estimates/new?customerId=${customerId}`}
        actionLabel="New estimate"
        empty="No estimates."
        items={estimates.map((e) => (
          <RecordLink
            key={String(e.id)}
            href={`/app/estimates/${e.id}`}
            title={String(e.title || e.number || e.id)}
            subtitle={formatCurrency(String((e.computed as Record<string, string> | undefined)?.grandTotal || "0"))}
            status={e.status ? String(e.status) : undefined}
          />
        ))}
      />
      <PipelineSection
        title="Quotes"
        empty="No quotes."
        items={quotes.map((q) => (
          <RecordLink
            key={String(q.id)}
            href={`/app/quotes/${q.id}`}
            title={String(q.number || q.id)}
            subtitle={formatCurrency(
              String(
                (q.computed as Record<string, string> | undefined)?.grandTotal || q.total_amount || "0",
              ),
            )}
            status={q.status ? String(q.status) : undefined}
          />
        ))}
      />
      <PipelineSection
        title="Projects"
        empty="Projects start when a quote is accepted."
        items={projects.map((p) => (
          <RecordLink
            key={String(p.id)}
            href={`/app/projects/${p.id}`}
            title={String(p.name || p.number || p.id)}
            subtitle={`${formatCurrency(String(p.contractValue || "0"))} · ${p.completionPercent ?? 0}%`}
            status={p.status ? String(p.status) : undefined}
          />
        ))}
      />
    </div>
  );
}

function Money({ summary, customerId }: { summary: Record<string, unknown>; customerId: string }) {
  const invoices = (summary.invoices as Brief[]) || [];
  const payments = (summary.payments as Brief[]) || [];
  const money = (summary.money || {}) as Record<string, string>;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/invoices/new?customerId=${customerId}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Create invoice
        </Link>
        <Link href="/app/payments/new" className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Record payment
        </Link>
        <Link href="/app/accounting" className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Accounts hub
        </Link>
      </div>
      <p className="text-sm text-stone-600">
        Outstanding {formatCurrency(money.outstanding)} · Collected {formatCurrency(money.collected)}
      </p>
      <PipelineSection
        title="Invoices"
        empty="No invoices."
        items={invoices.map((i) => (
          <RecordLink
            key={String(i.id)}
            href={`/app/invoices/${i.id}`}
            title={String(i.number || i.id)}
            subtitle={`${formatCurrency(String(i.total || i.total_amount || "0"))} · due ${formatCurrency(String(i.outstanding || "0"))}`}
            status={i.status ? String(i.status) : undefined}
          />
        ))}
      />
      <PipelineSection
        title="Payments"
        empty="No payments."
        items={payments.map((p) => (
          <div key={String(p.id)} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-medium">
              {formatCurrency(String(p.amount || "0"))} · {String(p.method || "")}
            </p>
            <p className="text-sm text-stone-600">
              {p.invoiceId ? (
                <Link href={`/app/invoices/${p.invoiceId}`} className="text-clay">
                  Invoice
                </Link>
              ) : (
                "Payment"
              )}{" "}
              · {formatDate(String(p.createdAt || ""))}
            </p>
          </div>
        ))}
      />
    </div>
  );
}

function FollowUps({
  customerId,
  items,
  onRefresh,
}: {
  customerId: string;
  items: Brief[];
  onRefresh: () => Promise<unknown>;
}) {
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await athena.customers.addFollowUp(customerId, { note, dueAt: dueAt || null });
      setNote("");
      setDueAt("");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={add} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <p className="font-medium">Add follow-up</p>
        <textarea
          className="rounded-xl border px-3 py-2"
          rows={3}
          required
          placeholder="Call about quote, visit site…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className="grid gap-1 text-sm">
          <span className="text-stone-600">Due date</span>
          <input className="rounded-xl border px-3 py-2" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Saving…" : "Add follow-up"}
        </button>
      </form>
      <div className="grid gap-2">
        {items.length === 0 ? <Empty>No open follow-ups.</Empty> : null}
        {items.map((f) => (
          <div key={String(f.id)} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <p className="font-medium">{String(f.note)}</p>
              <p className="text-xs text-stone-500">Due {formatDate(String(f.dueAt || ""))}</p>
            </div>
            <button
              type="button"
              className="text-sm text-clay"
              onClick={async () => {
                await athena.customers.completeFollowUp(String(f.id));
                await onRefresh();
              }}
            >
              Done
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerDetails({ id, onSaved }: { id: string; onSaved: () => Promise<unknown> }) {
  const load = useCallback(() => athena.customers.get(id), [id]);
  return (
    <EditableDetailPage
      title="Customer details"
      backHref={`/app/customers/${id}`}
      backLabel="Hub"
      load={load}
      save={async (form) => {
        await athena.customers.update(id, {
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          address: form.address || null,
          company: form.company || null,
          gstin: form.gstin || null,
          billingAddress: form.billingAddress || null,
          notes: form.notes || null,
        });
        await onSaved();
      }}
      mapToForm={(d) => ({
        name: String(d.name || ""),
        phone: String(d.phone || ""),
        email: String(d.email || ""),
        address: String(d.address || ""),
        company: String(d.company || ""),
        gstin: String(d.gstin || ""),
        billingAddress: String(d.billingAddress || ""),
        notes: String(d.notes || ""),
      })}
      fields={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "company", label: "Company" },
        { key: "gstin", label: "GSTIN" },
        { key: "address", label: "Address", multiline: true },
        { key: "billingAddress", label: "Billing address", multiline: true },
        { key: "notes", label: "Notes", multiline: true },
      ]}
    />
  );
}

function PipelineSection({
  title,
  items,
  empty,
  actionHref,
  actionLabel,
}: {
  title: string;
  items: ReactNode[];
  empty: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="text-sm text-clay">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="grid gap-2">{items.length ? items : <Empty>{empty}</Empty>}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">{children}</p>;
}
