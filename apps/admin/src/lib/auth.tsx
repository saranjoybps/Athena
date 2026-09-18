"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from "firebase/auth";
import { ApiError, platform } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

const SESSION_TOKEN_KEY = "athena.admin.token";

type AdminSession = {
  token: string;
  email?: string;
};

type AuthValue = {
  session: AdminSession | null;
  loading: boolean;
  unauthorized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

async function proveAccess(token: string) {
  await platform.tenants(token);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  async function acceptToken(token: string, email?: string) {
    try {
      await proveAccess(token);
      setUnauthorized(false);
      setSession({ token, email });
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch (err) {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setSession(null);
      if (err instanceof ApiError && err.status === 403) setUnauthorized(true);
      throw err;
    }
  }

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setSession(null);
        setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        await acceptToken(token, user.email ?? undefined);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      unauthorized,
      signIn: async (email, password) => {
        const auth = firebaseAuth();
        if (!auth) throw new Error("Firebase is not configured");
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const token = await cred.user.getIdToken();
        await acceptToken(token, cred.user.email ?? undefined);
      },
      signOut: async () => {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setSession(null);
        const auth = firebaseAuth();
        if (auth) await firebaseSignOut(auth);
      },
    }),
    [session, loading, unauthorized],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used within AuthProvider");
  return ctx;
}
