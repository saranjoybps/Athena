import type { SelectOption } from "@/components/ui/SelectDropdown";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p } from "@/lib/theme";

type Row = Record<string, unknown>;

export const PROJECT_STATUSES = ["scheduled", "active", "on_hold", "completed"] as const;

const STATUS_META: Record<string, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: p.muted, bg: p.slateSoft },
  scheduled: { label: "Scheduled", fg: p.blue, bg: p.blueSoft },
  active: { label: "In progress", fg: p.clayDark, bg: p.claySoft },
  on_hold: { label: "On hold", fg: p.amber, bg: p.amberSoft },
  completed: { label: "Completed", fg: "#15803D", bg: p.greenSoft },
};

export function projectStatusMeta(status: unknown) {
  return STATUS_META[String(status || "scheduled")] || STATUS_META.scheduled;
}

export const OTHER_CATEGORY = "other";

/** Day-to-day site spends. Materials, tools and labour line up with the estimate so spent can be compared with quoted. */
export const EXPENSE_CATEGORIES: SelectOption[] = [
  { id: "food", label: "Food & snacks", detail: "Tea, snacks, meals for the crew" },
  { id: "transport", label: "Transport", detail: "Auto, tempo, fuel, loading" },
  { id: "material", label: "Materials", detail: "Small purchases (counts against material lines)" },
  { id: "tool", label: "Tools & equipment hire", detail: "Counts against tool charges" },
  { id: "labour", label: "Labour charges", detail: "Only when no crew is scheduled on the project" },
  { id: "subcontractor", label: "Subcontractor", detail: "Work given to another contractor" },
  { id: OTHER_CATEGORY, label: "Other", detail: "Type your own category" },
];

export function isPresetCategory(category: unknown) {
  const key = String(category || "").toLowerCase();
  return key !== OTHER_CATEGORY && EXPENSE_CATEGORIES.some((c) => c.id === key);
}

export const PAID_BY: SelectOption[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "bank", label: "Bank transfer" },
  { id: "card", label: "Card" },
  { id: "credit", label: "On credit (pay later)" },
];

export function expenseCategoryLabel(category: unknown) {
  const raw = String(category || "").trim();
  const key = raw.toLowerCase();
  return EXPENSE_CATEGORIES.find((c) => c.id === key)?.label || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Expense");
}

/** Mirrors the API: labour is either entered as expenses or calculated from crew attendance, never both. */
export function isManualLabour(category: unknown) {
  return /^(labour|labor|wage)/i.test(String(category || "").trim());
}

export function categoryForKind(kind: unknown, crewScheduled = false) {
  if (kind === "material") return "material";
  if (kind === "tool") return "tool";
  return crewScheduled ? "subcontractor" : "labour";
}

export type BudgetLine = { id: string; kind: string; description: string; quantity: string; unit: string; amount: string; spent?: string };

export function budgetLinesOf(source: Row | undefined): BudgetLine[] {
  const rows = (source?.budgetLines as BudgetLine[] | undefined) || [];
  return rows.filter((l) => l && l.id);
}

export function budgetLineOptions(lines: BudgetLine[]): SelectOption[] {
  const kind: Record<string, string> = { work: "Work", material: "Material", tool: "Tool" };
  return lines.map((l) => ({
    id: l.id,
    label: l.description,
    detail: [kind[l.kind] || "Work", l.quantity && l.unit ? `${l.quantity} ${l.unit}` : "", formatCurrency(l.amount)].filter(Boolean).join(" · "),
  }));
}

export type ProjectStep = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  action?: "schedule" | "attendance" | "expense" | "invoice" | "payment" | "complete";
};

/** The project lifecycle that continues from an approved estimate, in the order work actually happens. */
export function projectSteps(ctx: {
  project: Row;
  schedules: number;
  attendance: number;
  expenses: number;
  invoices: Row[];
  manualLabour?: boolean;
}): ProjectStep[] {
  const contract = Number(ctx.project.contractValue || 0);
  const live = ctx.invoices.filter((i) => i.status !== "void");
  const billed = live.reduce((s, i) => s + Number(i.total || 0), 0);
  const due = live.reduce((s, i) => s + Math.max(0, Number(i.outstanding || 0)), 0);
  const completed = ctx.project.status === "completed";
  return [
    { key: "estimate", title: "Estimate approved", detail: "Contract value and budget come from the estimate.", done: true },
    ...(ctx.manualLabour && ctx.schedules === 0
      ? [
          {
            key: "schedule",
            title: "Labour entered manually",
            detail: "No crew is scheduled, so labour charges are logged as expenses.",
            done: true,
          },
        ]
      : [
          {
            key: "schedule",
            title: "Schedule the crew",
            detail: "Pick a crew and dates, or skip and enter labour charges as expenses.",
            done: ctx.schedules > 0 || completed,
            action: "schedule" as const,
          },
          {
            key: "attendance",
            title: "Mark daily attendance",
            detail: "Required once a crew is scheduled: days worked × daily rate becomes the labour cost.",
            done: ctx.attendance > 0 || completed,
            action: "attendance" as const,
          },
        ]),
    {
      key: "expense",
      title: "Log expenses & purchases",
      detail: "Book each spend against materials, tools or work so you see spent vs quoted.",
      done: ctx.expenses > 0 || completed,
      action: "expense",
    },
    {
      key: "invoice",
      title: billed > 0 && billed < contract ? `Bill the remaining ${formatCurrency(contract - billed)}` : "Invoice the customer",
      detail: "Raise advance or progress bills; the last one is the final invoice.",
      done: (contract > 0 && billed >= contract - 1) || completed,
      action: "invoice",
    },
    {
      key: "payment",
      title: due > 0 ? `Collect ${formatCurrency(due)} due` : "Collect payments",
      detail: "Record each payment against its invoice.",
      done: billed > 0 && due <= 0,
      action: "payment",
    },
    { key: "complete", title: "Close the project", detail: "Mark it completed once the work is handed over.", done: completed, action: "complete" },
  ];
}

/** Expenses are logged whenever money is spent, so they never block the suggested next step. */
export function nextProjectStep(steps: ProjectStep[]) {
  return steps.find((s) => !s.done && s.action && s.key !== "expense") || null;
}
