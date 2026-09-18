"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DocumentPreview } from "@/components/document-preview";
import { ErrorState } from "@/components/states";
import type { AthenaDocument } from "@/lib/documentBranding";
import { entityBackHref } from "@/lib/customer-nav";
import { formatCurrency, formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

function StartOrViewProject({
  quoteId,
  estimateId,
  siteId,
}: {
  quoteId: string;
  estimateId: string;
  siteId: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    athena.projects
      .list()
      .then((res) => {
        const found = res.items.find(
          (p) =>
            String(p.quoteId || "") === quoteId ||
            String(p.estimateId || "") === estimateId ||
            (siteId && String(p.siteId || "") === siteId),
        );
        setProjectId(found?.id ? String(found.id) : null);
      })
      .catch(() => setProjectId(null))
      .finally(() => setChecking(false));
  }, [quoteId, estimateId, siteId]);

  if (checking) {
    return (
      <button type="button" disabled className="rounded-xl border px-4 py-2 text-sm opacity-60">
        Checking project…
      </button>
    );
  }
  if (projectId) {
    return (
      <button
        type="button"
        className="rounded-xl bg-clay px-4 py-2 text-sm text-white"
        onClick={() => router.push(`/app/projects/${projectId}?tab=details`)}
      >
        View project
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={!quoteId}
      className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
      onClick={() => router.push(`/app/projects/new?quoteId=${quoteId}&estimateId=${estimateId}`)}
    >
      Start project
    </button>
  );
}

function EstimateDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const queryCustomerId = search.get("customerId") || "";
  const fromSite = search.get("fromSite") || "";
  const [estimate, setEstimate] = useState<Record<string, unknown> | null>(null);
  const [quote, setQuote] = useState<(AthenaDocument & Record<string, unknown>) | null>(null);
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [checkingProject, setCheckingProject] = useState(true);

  const load = useCallback(async () => {
    const est = await athena.estimates.get(id);
    setEstimate(est);
    if (est.customerId) {
      const c = await athena.customers.get(String(est.customerId));
      setCustomer(c);
    }
    const quotes = await athena.quotes.list();
    let linked = quotes.items.find((q) => String(q.estimateId || "") === id) as
      | (AthenaDocument & Record<string, unknown>)
      | undefined;
    if (!linked) {
      const created = (await athena.quotes.create({
        estimateId: id,
        validityDays: est.validUntil
          ? Math.max(1, Math.ceil((new Date(String(est.validUntil)).getTime() - Date.now()) / 86_400_000))
          : 15,
        notes: est.assumptions || null,
      })) as AthenaDocument & Record<string, unknown>;
      linked = created;
    } else {
      linked = (await athena.quotes.get(String(linked.id))) as AthenaDocument & Record<string, unknown>;
    }
    setQuote(linked);
    return { est, linked };
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [load]);

  useEffect(() => {
    if (!estimate) return;
    const quoteIdForCheck = quote?.id ? String(quote.id) : "";
    const siteIdForCheck = fromSite || String(estimate.siteId || "");
    setCheckingProject(true);
    athena.projects
      .list()
      .then((res) => {
        const found = res.items.find(
          (p) =>
            (quoteIdForCheck && String(p.quoteId || "") === quoteIdForCheck) ||
            String(p.estimateId || "") === id ||
            (siteIdForCheck && String(p.siteId || "") === siteIdForCheck),
        );
        setProjectId(found?.id ? String(found.id) : null);
      })
      .catch(() => setProjectId(null))
      .finally(() => setCheckingProject(false));
  }, [estimate, quote?.id, id, fromSite]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !estimate) return <ErrorState message={error} />;
  if (!estimate) return <p className="text-stone-600">Loading…</p>;

  const items = (estimate.items as Array<Record<string, unknown>>) || [];
  const computed = (estimate.computed as Record<string, unknown>) || {};
  const status = String(quote?.status || estimate.status || "draft");
  const statusLabel =
    status === "accepted" ? "approved" : status === "sent" ? "pending approval" : status === "rejected" ? "rejected" : "draft";
  const customerId = queryCustomerId || String(estimate.customerId || "");
  const siteId = fromSite || String(estimate.siteId || "");
  const backHref = entityBackHref({
    customerId,
    tab: "estimates",
    siteId: siteId || null,
    siteTab: "estimates",
  });
  const quoteId = quote?.id ? String(quote.id) : "";

  return (
    <div>
      <Link href={backHref} className="text-sm text-clay">
        ← {siteId ? "Site estimates" : "Back"}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{String(estimate.title || estimate.number || id)}</h1>
          <p className="mt-1 text-stone-600">
            {statusLabel} · {formatCurrency(String(computed.grandTotal || estimate.total || "0"))}
            {estimate.validUntil ? ` · Valid until ${formatDate(String(estimate.validUntil))}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!checkingProject && !projectId ? (
            <Link href={`/app/estimates/${id}/edit`} className="rounded-xl border px-4 py-2 text-sm">
              Edit
            </Link>
          ) : null}
          {status === "draft" || status === "sent" || status === "modification_requested" ? (
            <>
              <button
                type="button"
                disabled={busy || !quoteId}
                className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
                onClick={() => act(() => athena.quotes.accept(quoteId))}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy || !quoteId}
                className="rounded-xl border px-4 py-2 text-sm disabled:opacity-60"
                onClick={() => act(() => athena.quotes.reject(quoteId))}
              >
                Reject
              </button>
            </>
          ) : null}
          {status === "accepted" ? (
            <StartOrViewProject quoteId={quoteId} estimateId={id} siteId={siteId} />
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-2">
        {items.map((line, idx) => (
          <div key={idx} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-medium">{String(line.description || "Line")}</p>
            <p className="text-sm text-stone-600">
              {String(line.quantity)} {String(line.unit)} · mat {String(line.materialCost || 0)} · lab {String(line.labourCost || 0)}
              {line.rate ? ` · rate ${String(line.rate)}` : ""}
              {line.measurementItemId ? " · linked measurement" : ""}
            </p>
          </div>
        ))}
      </div>
      {estimate.assumptions ? <p className="mt-4 text-sm text-stone-600">Assumptions: {String(estimate.assumptions)}</p> : null}

      {quote ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">Estimate document</h2>
          <DocumentPreview doc={quote} kind="quotation" />
        </div>
      ) : null}
    </div>
  );
}

export default function EstimateDetailPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <EstimateDetailInner />
    </Suspense>
  );
}
