"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { ErrorState } from "@/components/states";
import { RecordLink } from "@/components/record-link";
import { customerHref } from "@/lib/customer-nav";
import { formatCurrency } from "@/lib/format";
import { invoiceHref, parseProjectTab, projectHref, type ProjectTab } from "@/lib/money-nav";
import { athena } from "@/lib/athena-client";

function ProjectDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const tabFromUrl = parseProjectTab(search.get("tab")) || "details";
  const [tab, setTab] = useState<ProjectTab>(tabFromUrl);
  const [project, setProject] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    athena.projects
      .get(id)
      .then(setProject)
      .catch(() => undefined);
  }, [id]);

  function goTab(next: ProjectTab) {
    setTab(next);
    router.replace(projectHref(id, next), { scroll: false });
  }

  const customerId = project?.customerId ? String(project.customerId) : "";
  const siteId = project?.siteId ? String(project.siteId) : "";

  return (
    <div>
      <Link href="/app/projects" className="text-sm text-clay">
        ← Projects
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{String(project?.name || "Project")}</h1>
      <p className="mt-1 text-stone-600">
        {String(project?.number || "")}
        {customerId ? (
          <>
            {" · "}
            <Link href={customerHref(customerId)} className="text-clay">
              Customer
            </Link>
          </>
        ) : null}
        {siteId ? (
          <>
            {" · "}
            <Link href={`/app/sites/${siteId}${customerId ? `?customerId=${customerId}` : ""}`} className="text-clay">
              Site
            </Link>
          </>
        ) : null}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {(
          [
            ["details", "Details"],
            ["money", "Money"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => goTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-clay text-white" : "bg-white text-stone-700 shadow-sm"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "details" ? <ProjectDetails id={id} /> : null}
        {tab === "money" ? <ProjectMoney id={id} customerId={customerId || null} /> : null}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <ProjectDetailInner />
    </Suspense>
  );
}

function ProjectDetails({ id }: { id: string }) {
  const load = useCallback(() => athena.projects.get(id), [id]);
  return (
    <EditableDetailPage
      title="Project details"
      backHref="/app/projects"
      backLabel="Projects"
      hideBack
      load={load}
      save={(form) =>
        athena.projects.update(id, {
          name: form.name,
          status: form.status,
          startDate: form.startDate || null,
          expectedCompletion: form.expectedCompletion || null,
          completionPercent: Number(form.completionPercent || 0),
          internalNotes: form.internalNotes || null,
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || ""),
        status: String(d.status || "scheduled"),
        startDate: String(d.startDate || ""),
        expectedCompletion: String(d.expectedCompletion || ""),
        completionPercent: String(d.completionPercent ?? 0),
        internalNotes: String(d.internalNotes || ""),
      })}
      fields={[
        { key: "name", label: "Project name" },
        {
          key: "status",
          label: "Status",
          options: [
            { value: "scheduled", label: "Scheduled" },
            { value: "active", label: "Active" },
            { value: "on_hold", label: "On hold" },
            { value: "completed", label: "Completed" },
          ],
        },
        { key: "startDate", label: "Start date", type: "date" },
        { key: "expectedCompletion", label: "Expected completion", type: "date" },
        { key: "completionPercent", label: "Completion %", type: "number" },
        { key: "internalNotes", label: "Internal notes", multiline: true },
      ]}
    />
  );
}

function ProjectMoney({ id, customerId }: { id: string; customerId: string | null }) {
  const [profit, setProfit] = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([athena.projectProfitability(id), athena.invoices.list(), athena.expenses.list()])
      .then(([p, inv, exp]) => {
        setProfit(p);
        setInvoices(inv.items.filter((i) => String(i.projectId) === id));
        setExpenses(exp.items.filter((e) => String(e.projectId) === id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load money"));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!profit) return <p className="text-stone-600">Loading…</p>;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyStat label="Contract" value={formatCurrency(String(profit.contractValue))} />
        <MoneyStat label="Billed" value={formatCurrency(String(profit.billed))} />
        <MoneyStat label="Collected" value={formatCurrency(String(profit.actualRevenue))} />
        <MoneyStat label="Actual profit" value={formatCurrency(String(profit.actualProfit))} />
      </div>
      <p className="text-sm text-stone-600">
        Costs {formatCurrency(String(profit.actualCost))} · Risk: {String(profit.risk || "ok")}
        {customerId ? (
          <>
            {" · "}
            <Link href={customerHref(customerId, "money")} className="text-clay">
              Customer money
            </Link>
          </>
        ) : null}
        {" · "}
        <Link href="/app/accounting" className="text-clay">
          Accounts
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/invoices/new?projectId=${id}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Create invoice
        </Link>
        <Link href={`/app/expenses/new?projectId=${id}`} className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Add expense
        </Link>
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Invoices</h2>
        <div className="grid gap-2">
          {invoices.length === 0 ? <p className="text-sm text-stone-500">No invoices on this project.</p> : null}
          {invoices.map((i) => (
            <RecordLink
              key={String(i.id)}
              href={invoiceHref(String(i.id), { projectId: id, from: "project" })}
              title={String(i.number || i.id)}
              subtitle={`${formatCurrency(String(i.total || i.total_amount || "0"))} · due ${formatCurrency(String(i.outstanding || "0"))}`}
              status={i.status ? String(i.status) : undefined}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Expenses</h2>
        <div className="grid gap-2">
          {expenses.length === 0 ? <p className="text-sm text-stone-500">No expenses logged.</p> : null}
          {expenses.map((e) => (
            <RecordLink
              key={String(e.id)}
              href={`/app/expenses/${e.id}?projectId=${id}`}
              title={`${formatCurrency(String(e.amount))} · ${String(e.category || "")}`}
              subtitle={`${e.billableToCustomer ? "On customer invoice" : "Internal cost only"}${e.description ? ` · ${e.description}` : ""}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MoneyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
