export type ProjectTab = "details" | "money";

export type AccountsTab = "overview" | "receivables" | "ledger" | "activity";

export function projectHref(projectId: string, tab?: ProjectTab) {
  if (!projectId) return "/app/projects";
  return tab ? `/app/projects/${projectId}?tab=${tab}` : `/app/projects/${projectId}`;
}

export function parseProjectTab(value: string | null | undefined): ProjectTab | null {
  if (value === "details" || value === "money") return value;
  return null;
}

export function accountsHref(tab?: AccountsTab) {
  return tab ? `/app/accounting?tab=${tab}` : "/app/accounting";
}

export function parseAccountsTab(value: string | null | undefined): AccountsTab | null {
  const allowed: AccountsTab[] = ["overview", "receivables", "ledger", "activity"];
  if (!value) return null;
  return allowed.includes(value as AccountsTab) ? (value as AccountsTab) : null;
}

export function invoiceHref(
  invoiceId: string,
  opts?: { projectId?: string | null; from?: "accounts" | "payments" | "project" | "customer" | null },
) {
  const params = new URLSearchParams();
  if (opts?.projectId) params.set("projectId", opts.projectId);
  if (opts?.from) params.set("from", opts.from);
  const qs = params.toString();
  return qs ? `/app/invoices/${invoiceId}?${qs}` : `/app/invoices/${invoiceId}`;
}

/** Prefer invoice → project money → accounts → payments list. */
export function paymentNavHref(opts: {
  invoiceId?: string | null;
  projectId?: string | null;
  from?: string | null;
  amount?: string | null;
}) {
  const params = new URLSearchParams();
  if (opts.invoiceId) params.set("invoiceId", opts.invoiceId);
  if (opts.projectId) params.set("projectId", opts.projectId);
  if (opts.from) params.set("from", opts.from);
  if (opts.amount) params.set("amount", opts.amount);
  const qs = params.toString();
  return qs ? `/app/payments/new?${qs}` : "/app/payments/new";
}

export function paymentBackHref(opts: {
  invoiceId?: string | null;
  projectId?: string | null;
  from?: string | null;
}) {
  const from = opts.from || "";
  if (from === "accounts") return accountsHref("receivables");
  if (from === "payments") return "/app/payments";
  if (opts.invoiceId) {
    return invoiceHref(opts.invoiceId, {
      projectId: opts.projectId,
      from: from === "project" || from === "customer" || from === "accounts" ? (from as "project" | "customer" | "accounts") : from === "invoice" ? "project" : undefined,
    });
  }
  if (opts.projectId) return projectHref(opts.projectId, "money");
  return "/app/payments";
}

export function invoiceBackHref(opts: {
  projectId?: string | null;
  from?: string | null;
  customerId?: string | null;
}) {
  if (opts.from === "accounts") return accountsHref("receivables");
  if (opts.from === "payments") return "/app/payments";
  if (opts.from === "customer" && opts.customerId) {
    return `/app/customers/${opts.customerId}?tab=money`;
  }
  if (opts.projectId) return projectHref(opts.projectId, "money");
  return "/app/projects";
}

export function expenseBackHref(opts: { projectId?: string | null; from?: string | null }) {
  if (opts.from === "accounts") return accountsHref("activity");
  if (opts.projectId) return projectHref(opts.projectId, "money");
  return "/app/projects";
}
