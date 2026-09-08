"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { ErrorState } from "@/components/states";
import { RecordLink } from "@/components/record-link";
import { customerHref, measurementSummary, parseCustomerTab, type CustomerTab } from "@/lib/customer-nav";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceHref } from "@/lib/money-nav";
import { athena } from "@/lib/athena-client";

type Tab = CustomerTab;
type Brief = Record<string, unknown> & { id?: string };

function CustomerHubInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const tabFromUrl = parseCustomerTab(search.get("tab")) || "overview";
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const load = useCallback(() => {
    return athena.customers.summary(id).then((s) => {
      setSummary(s);
      return s;
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  function goTab(next: Tab) {
    setTab(next);
    router.replace(customerHref(id, next), { scroll: false });
  }

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
            {[customer.phone, customer.email, customer.company].filter(Boolean).map(String).join(" · ") ||
              "Open a site to continue the job flow."}
          </p>
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
            ["sites", `Sites (${counts.sites ?? 0})`],
            ["surveys", `Surveys (${counts.surveys ?? 0})`],
            ["measurements", `Measurements (${counts.measurements ?? 0})`],
            ["estimates", `Estimates (${counts.estimates ?? 0})`],
            ["money", "Money"],
            ["followups", "Follow-ups"],
            ["details", "Details"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => goTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-clay text-white" : "bg-white text-stone-700 shadow-sm"}`}
          >
            {label}
            {key === "followups" && counts.openFollowUps ? ` (${counts.openFollowUps})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" ? <Overview summary={summary} customerId={id} onRefresh={load} /> : null}
        {tab === "sites" ? (
          <EntityList
            title="Sites"
            actionHref={`/app/sites/new?customerId=${id}`}
            actionLabel="Add site"
            empty="No sites yet."
            items={((summary.sites as Brief[]) || []).map((s) => (
              <RecordLink
                key={String(s.id)}
                href={`/app/sites/${s.id}?customerId=${id}`}
                title={String(s.name || s.id)}
                subtitle={String(s.address || "")}
              />
            ))}
          />
        ) : null}
        {tab === "surveys" ? (
          <EntityList
            title="Surveys"
            actionHref={`/app/surveys/new?customerId=${id}`}
            actionLabel="Add survey"
            empty="No surveys yet."
            items={((summary.surveys as Brief[]) || []).map((s) => (
              <RecordLink
                key={String(s.id)}
                href={
                  s.siteId
                    ? `/app/surveys/${s.id}?customerId=${id}&fromSite=${s.siteId}`
                    : `/app/surveys/${s.id}?customerId=${id}`
                }
                title={String(s.number || s.projectType || "Survey")}
                subtitle={String(s.notes || s.projectType || "No notes")}
                meta={formatDate(String(s.date || s.createdAt || ""))}
              />
            ))}
          />
        ) : null}
        {tab === "measurements" ? (
          <EntityList
            title="Measurements"
            actionHref={`/app/measurements/new?customerId=${id}`}
            actionLabel="Add measurement"
            empty="No measurements yet."
            items={((summary.measurements as Brief[]) || []).map((m) => (
              <RecordLink
                key={String(m.id)}
                href={
                  m.siteId
                    ? `/app/measurements/${m.id}?customerId=${id}&fromSite=${m.siteId}`
                    : `/app/measurements/${m.id}?customerId=${id}`
                }
                title={String(m.formulaKind || "Measurement")}
                subtitle={measurementSummary(m)}
              />
            ))}
          />
        ) : null}
        {tab === "estimates" ? (
          <EntityList
            title="Estimates"
            actionHref={`/app/estimates/new?customerId=${id}`}
            actionLabel="Add estimate"
            empty="No estimates yet."
            items={((summary.estimates as Brief[]) || []).map((e) => (
              <RecordLink
                key={String(e.id)}
                href={
                  e.siteId
                    ? `/app/estimates/${e.id}?customerId=${id}&fromSite=${e.siteId}`
                    : `/app/estimates/${e.id}?customerId=${id}`
                }
                title={String(e.title || e.number || e.id)}
                subtitle={formatCurrency(String((e.computed as Record<string, string> | undefined)?.grandTotal || "0"))}
                status={e.status ? String(e.status) : undefined}
              />
            ))}
          />
        ) : null}
        {tab === "money" ? <Money summary={summary} /> : null}
        {tab === "followups" ? <FollowUps customerId={id} items={(summary.followUps as Brief[]) || []} onRefresh={load} /> : null}
        {tab === "details" ? <CustomerDetails id={id} onSaved={load} /> : null}
      </div>
    </div>
  );
}

export default function CustomerHubPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <CustomerHubInner />
    </Suspense>
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
  const estimates = ((summary.estimates as Brief[]) || []).slice(0, 4);
  const projects = ((summary.projects as Brief[]) || []).slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">At a glance</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["Sites", counts.sites],
            ["Surveys", counts.surveys],
            ["Measurements", counts.measurements],
            ["Estimates", counts.estimates],
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
          <Link href={`/app/sites/new?customerId=${customerId}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
            Add site
          </Link>
        </div>
        <p className="mt-3 text-sm text-stone-500">
          Flow: Customer → Site → Survey → Measurement → Estimate
        </p>
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
              href={`/app/sites/${s.id}?customerId=${customerId}`}
              title={String(s.name || s.id)}
              subtitle={String(s.address || "")}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Estimates</h2>
        <div className="grid gap-2">
          {estimates.length === 0 ? <Empty>No estimates yet.</Empty> : null}
          {estimates.map((e) => (
            <RecordLink
              key={String(e.id)}
              href={
                e.siteId
                  ? `/app/estimates/${e.id}?customerId=${customerId}&fromSite=${e.siteId}`
                  : `/app/estimates/${e.id}?customerId=${customerId}`
              }
              title={String(e.title || e.number || e.id)}
              subtitle={formatCurrency(String((e.computed as Record<string, string> | undefined)?.grandTotal || "0"))}
              status={e.status ? String(e.status) : undefined}
            />
          ))}
        </div>
      </section>

      <section className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Projects</h2>
        <div className="grid gap-2">
          {projects.length === 0 ? <Empty>Projects start from an approved estimate.</Empty> : null}
          {projects.map((p) => (
            <RecordLink
              key={String(p.id)}
              href={`/app/projects/${p.id}?tab=money`}
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

function Money({ summary }: { summary: Record<string, unknown> }) {
  const invoices = (summary.invoices as Brief[]) || [];
  const payments = (summary.payments as Brief[]) || [];
  const money = (summary.money || {}) as Record<string, string>;

  return (
    <div className="grid gap-8">
      <p className="text-sm text-stone-600">
        Outstanding {formatCurrency(money.outstanding)} · Collected {formatCurrency(money.collected)}
      </p>
      <EntityList
        title="Invoices"
        empty="Invoices are created from projects."
        items={invoices.map((i) => (
          <RecordLink
            key={String(i.id)}
            href={invoiceHref(String(i.id), {
              projectId: i.projectId ? String(i.projectId) : null,
              from: "customer",
            })}
            title={String(i.number || i.id)}
            subtitle={`${formatCurrency(String(i.total || i.total_amount || "0"))} · due ${formatCurrency(String(i.outstanding || "0"))}`}
            status={i.status ? String(i.status) : undefined}
          />
        ))}
      />
      <EntityList
        title="Payments"
        empty="No payments."
        items={payments.map((p) => (
          <div key={String(p.id)} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-medium">
              {formatCurrency(String(p.amount || "0"))} · {String(p.method || "")}
            </p>
            <p className="text-sm text-stone-600">
              {p.invoiceId ? (
                <Link
                  href={invoiceHref(String(p.invoiceId), {
                    projectId: p.projectId ? String(p.projectId) : null,
                    from: "customer",
                  })}
                  className="text-clay"
                >
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
          placeholder="Call about estimate, visit site…"
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
      backHref={customerHref(id)}
      backLabel="Hub"
      hideBack
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
        { key: "company", label: "Company (optional)" },
        { key: "gstin", label: "GSTIN" },
        { key: "address", label: "Address", multiline: true },
        { key: "billingAddress", label: "Billing address", multiline: true },
        { key: "notes", label: "Notes", multiline: true },
      ]}
    />
  );
}

function EntityList({
  title,
  items,
  empty,
  actionHref,
  actionLabel,
  hint,
}: {
  title: string;
  items: ReactNode[];
  empty: string;
  actionHref?: string;
  actionLabel?: string;
  hint?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
          {hint ? <p className="mt-1 text-sm text-stone-500">{hint}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="rounded-xl bg-clay px-4 py-2 text-sm font-medium text-white shadow-sm">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="grid gap-2">
        {items.length ? items.map((item, index) => <div key={index}>{item}</div>) : <Empty>{empty}</Empty>}
      </div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">{children}</p>;
}
