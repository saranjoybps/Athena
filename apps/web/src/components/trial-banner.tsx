"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { showTrialBanner } from "@/lib/entitlements";
import { athena } from "@/lib/athena-client";

export function TrialBanner() {
  const { session, refresh } = useAuth();
  const ents = session?.entitlements;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showTrialBanner(ents)) return null;

  const days = ents?.days_remaining ?? 0;
  const usage = ents?.usage;
  const limits = ents?.limits;
  const pending = Boolean(ents?.upgrade_request_pending);

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

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">
        {ents?.status === "trial" ? `${days} day${days === 1 ? "" : "s"} left on your trial.` : "Account limits are enforced on this workspace."}
      </p>
      <p className="mt-1 text-amber-900">
        Users {usage?.users ?? 0}/{limits?.users || "∞"} · Customers {usage?.customers ?? 0}/{limits?.customers || "∞"} · Sites{" "}
        {usage?.sites ?? 0}/{limits?.sites || "∞"}
      </p>
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
