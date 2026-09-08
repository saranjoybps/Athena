"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { entityBackHref } from "@/lib/customer-nav";
import { athena } from "@/lib/athena-client";

function StartProjectForm() {
  const search = useSearchParams();
  const quoteId = search.get("quoteId") || "";
  const estimateId = search.get("estimateId") || "";
  const [ready, setReady] = useState(Boolean(quoteId));
  const [resolvedQuoteId, setResolvedQuoteId] = useState(quoteId);
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quoteId) {
      setResolvedQuoteId(quoteId);
      athena.quotes
        .get(quoteId)
        .then((q) => {
          if (q.customerId) setCustomerId(String(q.customerId));
          if (q.siteId) setSiteId(String(q.siteId));
        })
        .catch(() => undefined)
        .finally(() => setReady(true));
      return;
    }
    if (!estimateId) {
      setError("Open Start Project from an approved estimate.");
      setReady(true);
      return;
    }
    Promise.all([athena.estimates.get(estimateId), athena.quotes.list()])
      .then(([estimate, res]) => {
        if (estimate.customerId) setCustomerId(String(estimate.customerId));
        if (estimate.siteId) setSiteId(String(estimate.siteId));
        const linked = res.items.find(
          (q) => String(q.estimateId || "") === estimateId && String(q.status) === "accepted",
        );
        if (!linked) throw new Error("Approve the estimate before starting a project.");
        setResolvedQuoteId(String(linked.id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load estimate"))
      .finally(() => setReady(true));
  }, [quoteId, estimateId]);

  if (!ready) return <p className="text-stone-600">Loading…</p>;
  if (error || !resolvedQuoteId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Start project</h1>
        <p className="mt-2 text-sm text-red-700">{error || "Approved estimate required."}</p>
      </div>
    );
  }

  const backHref = estimateId
    ? entityBackHref({
        customerId,
        tab: "estimates",
        siteId,
        siteTab: "estimates",
        fallback: `/app/estimates/${estimateId}`,
      })
    : "/app/projects";

  return (
    <RecordFormPage
      title="Start project"
      subtitle="Project name is generated from the customer and site. Enter dates only."
      backHref={estimateId ? `/app/estimates/${estimateId}${customerId ? `?customerId=${customerId}` : ""}${siteId ? `${customerId ? "&" : "?"}fromSite=${siteId}` : ""}` : backHref}
      backLabel={estimateId ? "Estimate" : "Projects"}
      successHref={(r) => (r.id ? `/app/projects/${r.id}?tab=details` : "/app/projects")}
      fields={[
        { key: "startDate", label: "Start Date", type: "date", required: true },
        { key: "expectedCompletion", label: "End Date", type: "date", required: true },
      ]}
      onSubmit={async (form) => {
        const doc = (await athena.projects.fromQuote({
          quoteId: resolvedQuoteId,
          startDate: form.startDate,
          expectedCompletion: form.expectedCompletion,
        })) as { id?: string };
        return doc;
      }}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <StartProjectForm />
    </Suspense>
  );
}
