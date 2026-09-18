export type Entitlements = {
  status?: string;
  plan?: string;
  trial_ends_at?: string | null;
  trial_expired?: boolean;
  quota_enforced?: boolean;
  read_only?: boolean;
  limits?: { users?: number; customers?: number; sites?: number };
  usage?: { users?: number; customers?: number; sites?: number };
  upgrade_request_pending?: boolean;
  days_remaining?: number | null;
};

export type QuotaMetric = "users" | "customers" | "sites";

export function quotaReached(ents: Entitlements | null | undefined, metric: QuotaMetric): boolean {
  const limit = Number(ents?.limits?.[metric] ?? 0);
  const usage = Number(ents?.usage?.[metric] ?? 0);
  return limit > 0 && usage >= limit;
}

export function showTrialBanner(ents: Entitlements | null | undefined): boolean {
  if (!ents) return false;
  return ents.status === "trial" || Boolean(ents.quota_enforced);
}
