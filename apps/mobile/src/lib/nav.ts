/** Mobile navigation helpers aligned with web customer/money IA. */

export type CustomerTab = "details" | "sites" | "surveys" | "measurements" | "estimates" | "money";

export type SiteTab = "surveys" | "measurements" | "estimates";

type Nav = { canGoBack: () => boolean; back: () => void; replace: (href: never) => void };

/** Return to the screen this one was opened from; deep links with no history land on `fallback`. */
export function goBackOr(router: Nav, fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export type ProjectTab = "details" | "budget" | "team" | "money";

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
  const allowed: CustomerTab[] = ["details", "sites", "surveys", "measurements", "estimates", "money"];
  if (!value) return null;
  // Follow-ups and the old overview now live on the Details tab.
  if (value === "overview" || value === "followups") return "details";
  return allowed.includes(value as CustomerTab) ? (value as CustomerTab) : null;
}

export function parseSiteTab(value: string | null | undefined): SiteTab | null {
  const allowed: SiteTab[] = ["surveys", "measurements", "estimates"];
  if (!value) return null;
  return allowed.includes(value as SiteTab) ? (value as SiteTab) : null;
}

export function parseProjectTab(value: string | null | undefined): ProjectTab | null {
  const allowed: ProjectTab[] = ["details", "budget", "team", "money"];
  if (!value) return null;
  if (value === "overview") return "details";
  if (value === "expenses") return "budget";
  return allowed.includes(value as ProjectTab) ? (value as ProjectTab) : null;
}

export { measurementSummary } from "@/lib/measurements";
