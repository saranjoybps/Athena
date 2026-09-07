export function formatCurrency(value: string | number | null | undefined, currency = "INR"): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(dt?: string | null): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dt;
  }
}
