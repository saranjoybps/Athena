export type CustomerTab =
  | "overview"
  | "sites"
  | "surveys"
  | "measurements"
  | "estimates"
  | "money"
  | "followups"
  | "details";

export type SiteTab = "details" | "surveys" | "measurements" | "estimates";

export function customerHref(customerId: string, tab?: CustomerTab) {
  if (!customerId) return "/app/customers";
  return tab ? `/app/customers/${customerId}?tab=${tab}` : `/app/customers/${customerId}`;
}

export function siteHref(siteId: string, opts?: { customerId?: string | null; tab?: SiteTab }) {
  const params = new URLSearchParams();
  if (opts?.customerId) params.set("customerId", opts.customerId);
  if (opts?.tab) params.set("tab", opts.tab);
  const qs = params.toString();
  return qs ? `/app/sites/${siteId}?${qs}` : `/app/sites/${siteId}`;
}

export function parseSiteTab(value: string | null | undefined): SiteTab | null {
  const allowed: SiteTab[] = ["details", "surveys", "measurements", "estimates"];
  if (!value) return null;
  return allowed.includes(value as SiteTab) ? (value as SiteTab) : null;
}

/**
 * Child entities live under a site (Customer → Site → Survey → Measurement → Estimate).
 * Prefer returning to the site tab when site context exists.
 */
export function entityBackHref(opts: {
  customerId?: string | null;
  tab: CustomerTab;
  siteId?: string | null;
  siteTab?: SiteTab;
  fallback?: string;
}) {
  if (opts.siteId) {
    return siteHref(opts.siteId, {
      customerId: opts.customerId,
      tab: opts.siteTab || (opts.tab as SiteTab),
    });
  }
  if (opts.customerId) return customerHref(opts.customerId, opts.tab);
  return opts.fallback || "/app/customers";
}

export function parseCustomerTab(value: string | null | undefined): CustomerTab | null {
  const allowed: CustomerTab[] = [
    "overview",
    "sites",
    "surveys",
    "measurements",
    "estimates",
    "money",
    "followups",
    "details",
  ];
  if (!value) return null;
  return allowed.includes(value as CustomerTab) ? (value as CustomerTab) : null;
}

/** Short human summary for measurement list cards (avoid dumping JSON). */
export function measurementSummary(m: Record<string, unknown>): string {
  const notes = String(m.notes || "").trim();
  if (notes) return notes;
  const outputs = (m.outputs as Record<string, unknown>) || {};
  const items = Array.isArray((m.inputs as Record<string, unknown> | undefined)?.items)
    ? ((m.inputs as Record<string, unknown>).items as unknown[])
    : [];
  if (items.length) return `${items.length} item${items.length === 1 ? "" : "s"}`;
  const qty =
    outputs.paintableArea ?? outputs.totalArea ?? outputs.wallArea ?? outputs.quantity ?? outputs.area;
  if (qty != null && String(qty).trim()) {
    const n = Number(qty);
    return Number.isFinite(n) ? `${n.toFixed(0)} sqft` : `${qty} sqft`;
  }
  return String(m.formulaKind || "Measurement");
}
