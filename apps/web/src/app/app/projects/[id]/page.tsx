"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { ErrorState } from "@/components/states";
import { RecordLink } from "@/components/record-link";
import { formatCurrency } from "@/lib/format";
import { athena } from "@/lib/athena-client";

type Tab = "details" | "money";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("details");
  const [project, setProject] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    athena.projects
      .get(id)
      .then(setProject)
      .catch(() => undefined);
  }, [id]);

  return (
    <div>
      <Link href="/app/projects" className="text-sm text-clay">
        ← Projects
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{String(project?.name || "Project")}</h1>
      <p className="mt-1 text-stone-600">
        {String(project?.number || "")}
        {project?.customerId ? (
          <>
            {" · "}
            <Link href={`/app/customers/${String(project.customerId)}`} className="text-clay">
              Customer
            </Link>
          </>
        ) : null}
        {project?.siteId ? (
          <>
            {" · "}
            <Link href={`/app/sites/${String(project.siteId)}`} className="text-clay">
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
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-clay text-white" : "bg-white text-stone-700 shadow-sm"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "details" ? <ProjectDetails id={id} /> : null}
        {tab === "money" ? <ProjectMoney id={id} customerId={project?.customerId ? String(project.customerId) : null} /> : null}
      </div>
    </div>
  );
}

function ProjectDetails({ id }: { id: string }) {
  const load = useCallback(() => athena.projects.get(id), [id]);
  return (
    <EditableDetailPage
      title="Project details"
      backHref="/app/projects"
      backLabel="Projects"
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
    Promise.all([
      athena.projectProfitability(id),
      athena.invoices.list(),
      athena.expenses.list(),
    ])
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
            <Link href={`/app/customers/${customerId}`} className="text-clay">
              Customer CRM
            </Link>
          </>
        ) : null}
        {" · "}
        <Link href="/app/accounting" className="text-clay">
          Accounts
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/invoices/new" className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Invoice
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
              href={`/app/invoices/${i.id}`}
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
              href={`/app/expenses/${e.id}`}
              title={`${formatCurrency(String(e.amount))} · ${String(e.category || "")}`}
              subtitle={String(e.description || "")}
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
