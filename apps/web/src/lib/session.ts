import type { Entitlements } from "@/lib/entitlements";

export type Session = {
  userId: string;
  orgId: string | null;
  orgName?: string;
  email?: string;
  roles: string[];
  permissions: string[];
  /** Dev/demo bearer token (e.g. dev:local-owner). */
  accessToken?: string;
  entitlements?: Entitlements | null;
};

const KEY = "athena.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
