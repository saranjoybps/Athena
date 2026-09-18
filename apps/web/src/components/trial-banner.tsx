"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { showTrialBanner } from "@/lib/entitlements";
import { athena } from "@/lib/athena-client";

export function TrialBanner({ variant = "header" }: { variant?: "header" | "block" }) {
  const { session, refresh } = useAuth();
  const ents = session?.entitlements;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showTrialBanner(ents)) return null;

  const days = ents?.days_remaining ?? 0;
  const usage = ents?.usage;
  const limits = ents?.limits;
  const pending = Boolean(ents?.upgrade_request_pending);
  const expired = Boolean(ents?.trial_expired);

  const planLabel = expired
    ? "Trial ended"
    : ents?.status === "trial"
      ? `Trial · ${days} day${days === 1 ? "" : "s"} left`
      : ents?.plan
        ? `${String(ents.plan).charAt(0).toUpperCase()}${String(ents.plan).slice(1)} plan`
        : "Plan limits";

  const usageLabel = `Users ${usage?.users ?? 0}/${limits?.users || "∞"} · Customers ${usage?.customers ?? 0}/${
    limits?.customers || "∞"
  } · Sites ${usage?.sites ?? 0}/${limits?.sites || "∞"}`;

  async function requestUpgrade() {
    setBusy(true);
    setError(null);
    try {
      await athena.requestUpgrade("Please upgrade this workspace.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "block") {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">{planLabel}</p>
        <p className="mt-1 text-amber-900">{usageLabel}</p>
        {error ? <p className="mt-1 text-red-700">{error}</p> : null}
        <button
          type="button"
          className="mt-2 rounded-lg bg-clay px-3 py-1.5 text-white disabled:opacity-50"
          disabled={busy || pending}
          onClick={requestUpgrade}
        >
          {pending ? "Waiting for Athena admin" : busy ? "Sending…" : "Request upgrade"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="group relative">
        <button
          type="button"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            expired
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          aria-describedby="trial-plan-tooltip"
        >
          {planLabel}
        </button>
        <div
          id="trial-plan-tooltip"
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-max max-w-xs rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 shadow-md group-hover:block group-focus-within:block"
        >
          {usageLabel}
        </div>
      </div>
      <button
        type="button"
        className="rounded-lg bg-clay px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        disabled={busy || pending}
        onClick={requestUpgrade}
        title={error || undefined}
      >
        {pending ? "Upgrade pending" : busy ? "…" : "Upgrade"}
      </button>
    </div>
  );
}
