"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { entityBackHref } from "@/lib/customer-nav";
import { athena } from "@/lib/athena-client";

function StartProjectForm() {
  const router = useRouter();
  const search = useSearchParams();
  const quoteId = search.get("quoteId") || "";
  const estimateId = search.get("estimateId") || "";
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
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

  async function start() {
    if (!resolvedQuoteId) return;
    setBusy(true);
    setError(null);
    try {
      const doc = (await athena.projects.fromQuote({ quoteId: resolvedQuoteId })) as { id?: string };
      if (doc.id) router.replace(`/app/projects/${doc.id}?tab=details`);
      else router.replace("/app/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start project");
      setBusy(false);
    }
  }

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
    ? `/app/estimates/${estimateId}${customerId ? `?customerId=${customerId}` : ""}${siteId ? `${customerId ? "&" : "?"}fromSite=${siteId}` : ""}`
    : entityBackHref({ customerId, tab: "estimates", siteId, siteTab: "estimates", fallback: "/app/projects" });

  return (
    <div>
      <a href={backHref} className="text-sm text-clay">
        ← {estimateId ? "Estimate" : "Projects"}
      </a>
      <h1 className="mt-2 text-2xl font-semibold">Start project</h1>
      <p className="mt-2 text-sm text-stone-600">
        Project name is generated from the customer and site. Schedule dates are set on the Schedule module.
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="mt-6 rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {busy ? "Starting…" : "Create project"}
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <StartProjectForm />
    </Suspense>
  );
}
