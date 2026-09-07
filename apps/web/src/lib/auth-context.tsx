"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { clearSession, devToken, loadSession, saveSession, type Session } from "@/lib/session";

type MeResponse = {
  userId: string;
  email?: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  memberships: Array<{ organization: { id: string; name: string }; roles: string[] }>;
};

type AuthContextValue = {
  session: Session | null;
  /** True only during initial session restore — do not block login UI on this. */
  loading: boolean;
  signInDev: (userId?: string) => Promise<void>;
  setOrg: (orgId: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(userId: string, orgId?: string | null): Promise<MeResponse> {
  return api<MeResponse>("/api/v1/me", {
    token: devToken(userId),
    orgId: orgId ?? undefined,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async (base?: Session) => {
    const current = base ?? loadSession();
    if (!current) {
      setSession(null);
      return;
    }
    let me: MeResponse;
    try {
      me = await fetchMe(current.userId, current.orgId);
    } catch {
      // Stale org after API memory reseed — retry without org header.
      me = await fetchMe(current.userId, null);
    }
    if (!me.memberships?.length && !me.orgId) {
      // API has no memberships (empty memory store) — clear so user can re-login after seed.
      clearSession();
      setSession(null);
      throw new Error("No organization membership. Re-seed demo data, then sign in again.");
    }
    const membership = me.memberships?.[0];
    const membershipOrgId = membership?.organization?.id;
    const next: Session = {
      userId: me.userId,
      orgId: me.orgId ?? membershipOrgId ?? current.orgId,
      orgName: membership?.organization?.name,
      email: me.email,
      roles: me.roles?.length ? me.roles : membership?.roles ?? [],
      permissions: me.permissions,
    };
    saveSession(next);
    setSession(next);
  };

  useEffect(() => {
    let cancelled = false;
    const existing = loadSession();
    if (!existing) {
      setLoading(false);
      return;
    }
    const watchdog = window.setTimeout(() => {
      if (!cancelled) {
        clearSession();
        setSession(null);
        setLoading(false);
      }
    }, 8000);

    refresh(existing)
      .catch(() => {
        clearSession();
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        window.clearTimeout(watchdog);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      signInDev: async (userId = "local-owner") => {
        const base: Session = { userId, orgId: null, roles: [], permissions: [] };
        saveSession(base);
        await refresh(base);
      },
      setOrg: async (orgId: string) => {
        if (!session) return;
        const base = { ...session, orgId };
        saveSession(base);
        await refresh(base);
      },
      signOut: () => {
        clearSession();
        setSession(null);
      },
      refresh: async () => refresh(),
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
