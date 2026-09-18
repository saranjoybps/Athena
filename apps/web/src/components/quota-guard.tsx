"use client";

import type { ReactNode } from "react";
import { quotaReached, type QuotaMetric } from "@/lib/entitlements";
import { useAuth } from "@/lib/auth-context";

export function QuotaGuard({ metric, children }: { metric: QuotaMetric; children: ReactNode }) {
  const { session } = useAuth();
  if (quotaReached(session?.entitlements, metric)) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Account limit reached</h2>
        <p className="mt-2 text-sm text-stone-600">
          You cannot add more {metric} on this workspace. Request an upgrade from the banner, or ask Athena admin to raise the cap.
        </p>
      </div>
    );
  }
  return children;
}
