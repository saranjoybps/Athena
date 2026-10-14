import type { OrgBranding } from "@/hooks/useApi";

/** States and union territories, used for the GST place of supply. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const DEFAULT_DAYS = 15;

/** Whole-day setting from the organization, falling back when empty or invalid. */
export function orgDays(value: string | undefined, fallback = DEFAULT_DAYS): number {
  const n = Number(String(value || "").trim());
  return Number.isInteger(n) && n >= 0 && n <= 365 && String(value || "").trim() !== "" ? n : fallback;
}

/** Details printed on quotes and invoices; the More page prompts for them while any are empty. */
export function missingOrgDetails(b: OrgBranding | undefined): string[] {
  if (!b) return [];
  const checks: [string, string][] = [
    ["phone", b.phone],
    ["address", b.company_address],
    ["state", b.state],
    ["GSTIN", b.gst_number],
    ["bank or UPI", b.bank_account_number || b.upi_id],
  ];
  return checks.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
}
