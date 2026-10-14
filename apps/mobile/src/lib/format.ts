export function formatCurrency(value: string | number | null | undefined, currency = "INR"): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** "Today, 3:20 pm" / "Yesterday, 9:05 am" / "12 Oct 2026, 4:10 pm" */
export function formatDateTime(dt?: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((start.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  return `${formatDate(dt)}, ${time}`;
}

export function formatDate(dt?: string | null): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dt;
  }
}
