import type { SelectOption } from "@/components/ui/SelectDropdown";
import type { AthenaRecord } from "@/types";

export type CustomerType = "individual" | "company";

export const CUSTOMER_TYPES: SelectOption[] = [
  { id: "individual", label: "Individual", detail: "Home owner or person" },
  { id: "company", label: "Business", detail: "Company, builder or institution" },
];

export const CUSTOMER_SOURCES: SelectOption[] = [
  { id: "referral", label: "Referral" },
  { id: "walk_in", label: "Walk-in" },
  { id: "phone", label: "Phone enquiry" },
  { id: "website", label: "Website" },
  { id: "social", label: "Social media" },
  { id: "repeat", label: "Repeat customer" },
  { id: "other", label: "Other" },
];

export function customerTypeLabel(type: unknown) {
  return type === "company" ? "Business" : "Individual";
}

export function sourceLabel(source: unknown) {
  return CUSTOMER_SOURCES.find((s) => s.id === source)?.label || "";
}

export type CustomerValues = {
  type: CustomerType;
  name: string;
  company: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  gstin: string;
  source: string;
  notes: string;
};

export type CustomerErrors = Partial<Record<keyof CustomerValues, string>>;

export const EMPTY_CUSTOMER: CustomerValues = {
  type: "individual",
  name: "",
  company: "",
  phone: "",
  alternatePhone: "",
  email: "",
  address: "",
  gstin: "",
  source: "",
  notes: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function phoneDigits(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function phoneError(value: string): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return "Enter a valid 10-digit phone number";
  return undefined;
}

export function validateCustomer(v: CustomerValues): CustomerErrors {
  const errors: CustomerErrors = {};
  if (!v.name.trim()) errors.name = v.type === "company" ? "Enter the contact person's name" : "Enter the customer's name";
  if (!v.phone.trim()) errors.phone = "Enter a phone number";
  else errors.phone = phoneError(v.phone);
  if (v.alternatePhone.trim()) {
    errors.alternatePhone = phoneError(v.alternatePhone);
    if (!errors.alternatePhone && phoneDigits(v.alternatePhone) === phoneDigits(v.phone)) {
      errors.alternatePhone = "Use a different number from the main phone";
    }
  }
  if (v.email.trim() && !EMAIL.test(v.email.trim())) errors.email = "Enter a valid email address";
  if (v.type === "company") {
    if (!v.company.trim()) errors.company = "Enter the business name";
    if (v.gstin.trim() && !GSTIN.test(v.gstin.trim().toUpperCase())) errors.gstin = "Enter a valid 15-character GSTIN";
  }
  for (const key of Object.keys(errors) as (keyof CustomerValues)[]) if (!errors[key]) delete errors[key];
  return errors;
}

export function customerValuesFrom(c: AthenaRecord): CustomerValues {
  const text = (v: unknown) => (v == null ? "" : String(v));
  return {
    type: c.type === "company" ? "company" : "individual",
    name: text(c.name),
    company: text(c.company),
    phone: text(c.phone),
    alternatePhone: text(c.alternatePhone),
    email: text(c.email),
    // Older records kept a separate billing address; it wins because invoices print it.
    address: text(c.billingAddress || c.address),
    gstin: text(c.gstin),
    source: text(c.source),
    notes: text(c.notes),
  };
}

export function customerBody(v: CustomerValues): Record<string, unknown> {
  const opt = (s: string) => s.trim() || null;
  const business = v.type === "company";
  return {
    type: v.type,
    name: v.name.trim(),
    company: business ? opt(v.company) : null,
    phone: phoneDigits(v.phone.trim()),
    alternatePhone: v.alternatePhone.trim() ? phoneDigits(v.alternatePhone.trim()) : null,
    email: v.email.trim() ? v.email.trim().toLowerCase() : null,
    address: opt(v.address),
    billingAddress: opt(v.address),
    gstin: business && v.gstin.trim() ? v.gstin.trim().toUpperCase() : null,
    source: v.source || null,
    notes: opt(v.notes),
  };
}

/** Other customers already saved with this phone number (shown as a warning, not a block). */
export function duplicatePhone(customers: AthenaRecord[], phone: string, selfId?: string) {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  if (last10.length < 10) return undefined;
  return customers.find(
    (c) => String(c.id) !== selfId && String(c.phone || "").replace(/\D/g, "").slice(-10) === last10,
  );
}

export function customerDisplayName(c: AthenaRecord | Record<string, unknown> | undefined) {
  if (!c) return "Customer";
  return String(c.type === "company" && c.company ? c.company : c.name || "Customer");
}
