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
  loading: boolean;
  signInDev: (userId?: string) => Promise<void>;
  setOrg: (orgId: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async (base?: Session) => {
    const current = base ?? loadSession();
    if (!current) {
      setSession(null);
      return;
    }
    const me = await api<MeResponse>("/api/v1/me", {
      token: devToken(current.userId),
      orgId: current.orgId ?? undefined,
    });
    const next: Session = {
      userId: me.userId,
      orgId: me.orgId ?? current.orgId,
      email: me.email,
      roles: me.roles,
      permissions: me.permissions,
    };
    saveSession(next);
    setSession(next);
  };

  useEffect(() => {
    const existing = loadSession();
    if (!existing) {
      setLoading(false);
      return;
    }
    refresh(existing)
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      signInDev: async (userId = "local-owner") => {
        const base = { userId, orgId: null, roles: [], permissions: [] };
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
