import type { SelectOption } from "@/components/ui/SelectDropdown";
import { lightPalette as p } from "@/lib/theme";

export const WORK_TYPES: SelectOption[] = [
  { id: "interior_painting", label: "Interior painting" },
  { id: "exterior_painting", label: "Exterior painting" },
  { id: "waterproofing", label: "Waterproofing" },
  { id: "texture_finish", label: "Texture / designer finish" },
  { id: "wood_polish", label: "Wood polish" },
  { id: "putty_plaster", label: "Putty & plaster repair" },
  { id: "flooring", label: "Flooring" },
  { id: "false_ceiling", label: "False ceiling" },
  { id: "renovation", label: "Renovation" },
  { id: "other", label: "Other" },
];

/** Older surveys stored free text; show it as-is when it isn't one of the options. */
export function workTypeLabel(value: unknown) {
  const v = String(value || "").trim();
  if (!v) return "";
  return WORK_TYPES.find((t) => t.id === v)?.label || v.charAt(0).toUpperCase() + v.slice(1);
}

export const SITE_TYPES: SelectOption[] = [
  { id: "apartment", label: "Apartment / flat" },
  { id: "independent_house", label: "Independent house" },
  { id: "villa", label: "Villa" },
  { id: "office", label: "Office" },
  { id: "shop", label: "Shop / showroom" },
  { id: "commercial", label: "Commercial building" },
  { id: "industrial", label: "Factory / warehouse" },
  { id: "institution", label: "School / hospital / institution" },
  { id: "other", label: "Other" },
];

export function siteTypeLabel(value: unknown) {
  const v = String(value || "").trim();
  if (!v) return "";
  return SITE_TYPES.find((t) => t.id === v)?.label || v.charAt(0).toUpperCase() + v.slice(1);
}

export type EstimateStatus = "draft" | "sent" | "approved" | "rejected" | "changes_requested";

const STATUS_META: Record<EstimateStatus, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: "#475569", bg: p.slateSoft },
  sent: { label: "Sent", fg: "#1D4ED8", bg: p.blueSoft },
  approved: { label: "Approved", fg: "#15803D", bg: p.greenSoft },
  rejected: { label: "Rejected", fg: p.red, bg: p.redSoft },
  changes_requested: { label: "Changes asked", fg: "#B45309", bg: p.amberSoft },
};

export function estimateStatusMeta(status: unknown) {
  const key = String(status || "draft");
  if (key === "accepted" || key === "invoiced") return STATUS_META.approved;
  if (key === "modification_requested") return STATUS_META.changes_requested;
  return STATUS_META[key as EstimateStatus] || STATUS_META.draft;
}

/** Quote status → estimate status (the quote holds the customer's decision). */
export function estimateStatusFromQuote(quoteStatus: unknown, fallback?: unknown): EstimateStatus {
  switch (String(quoteStatus || "")) {
    case "accepted":
    case "invoiced":
      return "approved";
    case "rejected":
      return "rejected";
    case "sent":
      return "sent";
    case "modification_requested":
      return "changes_requested";
    default: {
      const f = String(fallback || "draft");
      return (["draft", "sent", "approved", "rejected", "changes_requested"].includes(f) ? f : "draft") as EstimateStatus;
    }
  }
}

function monthYear(date?: string) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** "Interior painting — Green Villa" */
export function estimateAutoTitle(opts: { workType?: string; siteName?: string }) {
  const work = (opts.workType !== "other" && workTypeLabel(opts.workType)) || "Estimate";
  return opts.siteName ? `${work} — ${opts.siteName}` : work;
}

/** "Site measurement — Green Villa (Oct 2026)" */
export function measurementAutoTitle(siteName?: string, date?: string) {
  const when = monthYear(date);
  return `Measurement${siteName ? ` — ${siteName}` : ""}${when ? ` (${when})` : ""}`;
}

/** "Home — Anna Nagar" from the address' locality, else "<Type> site". */
export function siteAutoName(opts: { siteType?: string; address?: string; customerName?: string }) {
  const typeLabel = siteTypeLabel(opts.siteType);
  const parts = String(opts.address || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^\d{6}$/.test(s) && !/^\d+[\w/-]*$/.test(s));
  const locality = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const head = typeLabel ? typeLabel.split(" / ")[0] : "Site";
  if (locality) return `${head} — ${locality}`;
  if (opts.customerName) return `${opts.customerName} — ${head}`;
  return head;
}
