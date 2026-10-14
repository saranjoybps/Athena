import type { SelectOption } from "@/components/ui/SelectDropdown";

type Money = string;

export type PeriodReport = {
  period: { mode: ReportMode; year: number; month: number | null; label: string; from: string; to: string };
  summary: {
    billed: Money;
    invoiceCount: number;
    collected: Money;
    paymentCount: number;
    expenses: Money;
    billableExpenses: Money;
    internalExpenses: Money;
    expenseCount: number;
    purchases: Money;
    purchaseCount: number;
    costs: Money;
    net: Money;
    margin: Money | null;
    outputTax: Money;
    inputTax: Money;
    netTax: Money;
    outstandingNow: Money;
    openInvoiceCount: number;
  };
  trend: Array<{
    key: string;
    label: string;
    year: number | null;
    month: number | null;
    billed: Money;
    collected: Money;
    costs: Money;
    net: Money;
  }>;
  expenseByCategory: Array<{ category: string; amount: Money; count: number }>;
  topCustomers: Array<{ customerId: string | null; customerName: string; billed: Money; collected: Money }>;
  invoices: Array<{
    id: string;
    number?: string;
    date: string;
    customerName?: string;
    projectName?: string;
    status?: string;
    total: Money;
    outstanding: Money;
    taxTotal: Money;
  }>;
  payments: Array<{
    id: string;
    number?: string;
    date: string;
    amount: Money;
    method?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    customerName?: string;
  }>;
  expenses: Array<{
    id: string;
    date: string;
    category: string;
    amount: Money;
    description?: string;
    projectName?: string;
    billable: boolean;
  }>;
  purchases: Array<{
    id: string;
    date: string;
    supplier?: string;
    invoiceNumber?: string;
    total: Money;
    taxTotal: Money;
    projectName?: string;
  }>;
  gst: {
    outward: GstTotals;
    inward: GstTotals;
    outwardRows: GstRow[];
    inwardRows: GstRow[];
  };
  attendance: {
    records: number;
    present: number;
    halfDay: number;
    absent: number;
    leave: number;
    overtime: number;
    workers: number;
    workerDays: string;
  };
  receivables: {
    customers: Array<{ customerId: string | null; customerName: string; outstanding: Money; invoiceCount: number }>;
    invoices: Array<{
      id: string;
      number?: string;
      customerName?: string;
      status?: string;
      total: Money;
      outstanding: Money;
      dueDate?: string;
    }>;
  };
  ledger: Array<{ id: string; date: string; type?: string; amount: Money; reference?: string; notes?: string }>;
};

export type GstTotals = { taxableAmount: Money; cgst: Money; sgst: Money; igst: Money; taxTotal: Money };
export type GstRow = {
  id: string;
  number?: string;
  date: string;
  party?: string;
  gstin?: string;
  taxableAmount: Money;
  taxTotal: Money;
  total: Money;
};

export type ReportMode = "month" | "year";
export type ReportSection = "invoices" | "payments" | "expenses" | "purchases" | "gst" | "receivables" | "ledger" | "measurements";
/** `year` is the calendar year in month mode and the financial-year start (April) in year mode. */
export type ReportPeriod = { mode: ReportMode; year: number; month: number };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HISTORY_YEARS = 6;

function today() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function fyStartFor(year: number, month: number) {
  return month >= 4 ? year : year - 1;
}

export function currentPeriod(mode: ReportMode = "month"): ReportPeriod {
  const { year, month } = today();
  return mode === "month" ? { mode, year, month } : { mode, year: fyStartFor(year, month), month };
}

export function fyLabel(startYear: number) {
  return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function periodLabel(period: ReportPeriod) {
  return period.mode === "month" ? `${MONTHS[period.month - 1]} ${period.year}` : fyLabel(period.year);
}

export function monthOptions(year: number): SelectOption[] {
  const now = today();
  const last = year === now.year ? now.month : 12;
  return MONTHS.slice(0, last).map((name, i) => ({ id: String(i + 1), label: name }));
}

export function yearOptions(): SelectOption[] {
  const { year } = today();
  return Array.from({ length: HISTORY_YEARS }, (_, i) => ({ id: String(year - i), label: String(year - i) }));
}

export function fyOptions(): SelectOption[] {
  const now = today();
  const current = fyStartFor(now.year, now.month);
  return Array.from({ length: HISTORY_YEARS }, (_, i) => ({
    id: String(current - i),
    label: fyLabel(current - i),
    detail: `Apr ${current - i} - Mar ${current - i + 1}`,
  }));
}

export function isCurrentOrFuture(period: ReportPeriod) {
  const now = currentPeriod(period.mode);
  if (period.mode === "year") return period.year >= now.year;
  return period.year > now.year || (period.year === now.year && period.month >= now.month);
}

export function isOldest(period: ReportPeriod) {
  const now = today();
  if (period.mode === "year") return period.year <= fyStartFor(now.year, now.month) - HISTORY_YEARS + 1;
  const oldest = now.year - HISTORY_YEARS + 1;
  return period.year < oldest || (period.year === oldest && period.month <= 1);
}

export function stepPeriod(period: ReportPeriod, delta: 1 | -1): ReportPeriod {
  if (period.mode === "year") return { ...period, year: period.year + delta };
  const index = period.year * 12 + (period.month - 1) + delta;
  return { mode: "month", year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Switching views keeps the user in the same time frame. */
export function switchMode(period: ReportPeriod, mode: ReportMode): ReportPeriod {
  if (mode === period.mode) return period;
  if (mode === "year") return { mode, year: fyStartFor(period.year, period.month), month: period.month };
  const now = today();
  const inThisFy = fyStartFor(now.year, now.month) === period.year;
  return inThisFy ? { mode, year: now.year, month: now.month } : { mode, year: period.year + 1, month: 3 };
}

export function periodParams(period: ReportPeriod) {
  return { mode: period.mode, year: String(period.year), month: String(period.month) };
}

export function periodFromParams(params: { mode?: string; year?: string; month?: string }): ReportPeriod {
  const fallback = currentPeriod(params.mode === "year" ? "year" : "month");
  const year = Number(params.year);
  const month = Number(params.month);
  return {
    mode: params.mode === "year" ? "year" : "month",
    year: Number.isInteger(year) && year > 2000 ? year : fallback.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback.month,
  };
}

export function expenseCategoryLabel(category: unknown) {
  const text = String(category || "other").replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function shortDate(iso: unknown) {
  const text = String(iso || "");
  const d = new Date(`${text.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
