import type { AthenaRecord } from "@/types";
import { lightPalette as p } from "@/lib/theme";

export type Span = { id: string; start: string; end: string; workingDates?: string[] };
export type WindowState = "active" | "upcoming" | "ended" | "unscheduled";

export const ATTENDANCE_STATUSES = [
  { id: "present", label: "Present", short: "P", color: p.green, soft: p.greenSoft },
  { id: "half_day", label: "Half day", short: "½", color: p.amber, soft: p.amberSoft },
  { id: "leave", label: "Leave", short: "L", color: p.blue, soft: p.blueSoft },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]["id"];

export function statusMeta(status: unknown) {
  const key = String(status || "");
  if (key === "overtime") return ATTENDANCE_STATUSES[0];
  if (key === "absent") return ATTENDANCE_STATUSES[2];
  return ATTENDANCE_STATUSES.find((s) => s.id === key);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Device-local calendar day (YYYY-MM-DD); `toISOString` would give the UTC day. */
export function localIso(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function dayLabel(iso: string, withYear = true) {
  return parseDay(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function rangeLabel(start: string, end: string) {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (start === end) return dayLabel(start);
  return `${dayLabel(start, !sameYear)} – ${dayLabel(end)}`;
}

/** Schedule rows for one project (and optionally one crew) as day ranges. */
export function scheduleSpans(schedules: AthenaRecord[], projectId: string, crewId?: string): Span[] {
  return schedules
    .filter((s) => String(s.projectId || "") === projectId && (!crewId || String(s.crewId || "") === crewId))
    .map((s) => {
      const start = String(s.startDate || "").slice(0, 10);
      const end = String(s.endDate || s.startDate || "").slice(0, 10);
      const listed = Array.isArray(s.workingDates) ? s.workingDates.map((d) => String(d).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
      return { id: String(s.id), start, end, workingDates: listed.length ? listed : undefined };
    })
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.start) && /^\d{4}-\d{2}-\d{2}$/.test(s.end))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function windowOf(spans: Span[]) {
  if (spans.length === 0) return null;
  return {
    start: spans.reduce((min, s) => (s.start < min ? s.start : min), spans[0].start),
    end: spans.reduce((max, s) => (s.end > max ? s.end : max), spans[0].end),
  };
}

export function windowState(spans: Span[], today = localIso()): WindowState {
  if (spans.length === 0) return "unscheduled";
  if (spans.some((s) => s.start <= today && today <= s.end)) return "active";
  if (spans.some((s) => s.start > today)) return "upcoming";
  return "ended";
}

export function windowStateLabel(spans: Span[], today = localIso()) {
  const state = windowState(spans, today);
  if (state === "unscheduled") return "No crew scheduled";
  if (state === "active") return "In progress";
  if (state === "upcoming") {
    const next = spans.filter((s) => s.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
    return `Starts ${dayLabel(next.start, false)}`;
  }
  const w = windowOf(spans);
  return `Ended ${dayLabel(w!.end, false)}`;
}

export const STATE_TONE: Record<WindowState, { color: string; soft: string }> = {
  active: { color: p.green, soft: p.greenSoft },
  upcoming: { color: p.blue, soft: p.blueSoft },
  ended: { color: p.muted, soft: p.slateSoft },
  unscheduled: { color: p.amber, soft: p.amberSoft },
};

/** Days that can be marked: the crew's chosen working days, up to today. A day left off the schedule is not included. */
export function markableDays(spans: Span[], today = localIso()): string[] {
  const days = new Set<string>();
  for (const s of spans) {
    const end = s.end < today ? s.end : today;
    const chosen = s.workingDates?.length ? s.workingDates : null;
    if (chosen) {
      for (const day of chosen) {
        if (day >= s.start && day <= end) days.add(day);
      }
      continue;
    }
    for (let d = parseDay(s.start); localIso(d) <= end; d.setDate(d.getDate() + 1)) {
      days.add(localIso(d));
    }
  }
  return [...days].sort();
}

export function markDay(row: AthenaRecord) {
  return String(row.date || "").slice(0, 10);
}
