/** Mobile navigation helpers aligned with web customer/money IA. */

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

export type ProjectTab = "details" | "money" | "field";

export function customerPath(customerId: string, tab?: CustomerTab) {
  if (!customerId) return "/(tabs)/customers";
  return tab ? `/(tabs)/customers/${customerId}?tab=${tab}` : `/(tabs)/customers/${customerId}`;
}

export function sitePath(siteId: string, opts?: { customerId?: string | null; tab?: SiteTab }) {
  const params = new URLSearchParams();
  if (opts?.customerId) params.set("customerId", opts.customerId);
  if (opts?.tab) params.set("tab", opts.tab);
  const qs = params.toString();
  return qs ? `/(tabs)/sites/${siteId}?${qs}` : `/(tabs)/sites/${siteId}`;
}

export function projectPath(projectId: string, tab?: ProjectTab) {
  return tab ? `/(tabs)/projects/${projectId}?tab=${tab}` : `/(tabs)/projects/${projectId}`;
}

export function entityBackPath(opts: {
  customerId?: string | null;
  tab: CustomerTab;
  siteId?: string | null;
  siteTab?: SiteTab;
  fallback?: string;
}) {
  if (opts.siteId) {
    return sitePath(opts.siteId, {
      customerId: opts.customerId,
      tab: opts.siteTab || (opts.tab as SiteTab),
    });
  }
  if (opts.customerId) return customerPath(opts.customerId, opts.tab);
  return opts.fallback || "/(tabs)/customers";
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

export function parseSiteTab(value: string | null | undefined): SiteTab | null {
  const allowed: SiteTab[] = ["details", "surveys", "measurements", "estimates"];
  if (!value) return null;
  return allowed.includes(value as SiteTab) ? (value as SiteTab) : null;
}

export function parseProjectTab(value: string | null | undefined): ProjectTab | null {
  const allowed: ProjectTab[] = ["details", "money", "field"];
  if (!value) return null;
  return allowed.includes(value as ProjectTab) ? (value as ProjectTab) : null;
}

/** Short human summary for measurement list cards (avoid dumping JSON). */
export function measurementSummary(m: Record<string, unknown>): string {
  const notes = String(m.notes || "").trim();
  const cfgOut =
    ((m.formulaConfig as { outputs?: Record<string, unknown> } | undefined)?.outputs as
      | Record<string, unknown>
      | undefined) || {};
  const outputs = { ...((m.outputs as Record<string, unknown>) || {}), ...cfgOut };
  const items = Array.isArray((m.inputs as Record<string, unknown> | undefined)?.items)
    ? ((m.inputs as Record<string, unknown>).items as unknown[])
    : [];
  const qty =
    outputs.paintableArea ?? outputs.totalArea ?? outputs.wallArea ?? outputs.quantity ?? outputs.area;
  if (qty != null && String(qty).trim()) {
    const n = Number(qty);
    const area = Number.isFinite(n) ? `${n.toFixed(0)} sqft` : `${qty} sqft`;
    if (items.length) return `${items.length} line${items.length === 1 ? "" : "s"} · ${area}`;
    return area;
  }
  if (items.length) return `${items.length} item${items.length === 1 ? "" : "s"}`;
  if (notes) return notes;
  return String(m.formulaKind || "Measurement");
}
