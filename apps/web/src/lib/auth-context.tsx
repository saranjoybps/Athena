"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { api, API_URL, ApiError } from "@/lib/api";
import { DEMO_TOKEN, isDemoLogin } from "@/lib/demo-auth";
import type { Entitlements } from "@/lib/entitlements";
import { clearSession, loadSession, saveSession, type Session } from "@/lib/session";
import { firebaseAuth, getIdToken } from "@/lib/firebase";

type MeResponse = {
  userId: string;
  email?: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  memberships: Array<{ organization: { id: string; name: string }; roles: string[] }>;
  entitlements?: Entitlements | null;
};

type AuthContextValue = {
  session: Session | null;
  firebaseUser: User | null;
  /** True only during initial session restore — do not block login UI on this. */
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<Session>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<Session>;
  startTrial: (input: { companyName: string; ownerName: string; email: string; password: string }) => Promise<Session>;
  signInWithGoogle: () => Promise<Session>;
  setOrg: (orgId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function redirectTrialExpired() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.replace("/login?reason=trial_expired");
}

async function fetchMe(token: string, orgId?: string | null): Promise<MeResponse> {
  return api<MeResponse>("/api/v1/me", {
    token,
    orgId: orgId ?? undefined,
  });
}

function sessionFromMe(me: MeResponse, currentOrgId?: string | null, accessToken?: string): Session {
  const membership = me.memberships?.[0];
  const membershipOrgId = membership?.organization?.id;
  return {
    userId: me.userId,
    orgId: me.orgId ?? membershipOrgId ?? currentOrgId ?? null,
    orgName: membership?.organization?.name,
    email: me.email,
    roles: me.roles?.length ? me.roles : membership?.roles ?? [],
    permissions: me.permissions ?? [],
    accessToken,
    entitlements: me.entitlements,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hardSignOut = async () => {
    const auth = firebaseAuth();
    clearSession();
    setSession(null);
    if (auth) await firebaseSignOut(auth);
  };

  const refreshFromToken = async (token: string, orgId?: string | null) => {
    const me = await fetchMe(token, orgId ?? null);
    const next = sessionFromMe(me, orgId, token.startsWith("dev:") ? token : undefined);
    if (next.entitlements?.trial_expired) {
      await hardSignOut();
      redirectTrialExpired();
      throw new ApiError("Your trial has ended.", 403, "trial_expired");
    }
    saveSession(next);
    setSession(next);
    return next;
  };

  const refreshFromUser = async (user: User, orgId?: string | null) => {
    const token = await user.getIdToken();
    return refreshFromToken(token, orgId);
  };

  useEffect(() => {
    const onExpired = () => {
      hardSignOut().finally(() => redirectTrialExpired());
    };
    window.addEventListener("athena:trial-expired", onExpired);
    return () => window.removeEventListener("athena:trial-expired", onExpired);
  }, []);

  useEffect(() => {
    const auth = firebaseAuth();

    async function restoreDemoSession() {
      const existing = loadSession();
      if (existing?.accessToken?.startsWith("dev:")) {
        try {
          await refreshFromToken(existing.accessToken, existing.orgId ?? null);
        } catch {
          clearSession();
          setSession(null);
        }
        setLoading(false);
        return true;
      }
      return false;
    }

    if (!auth) {
      restoreDemoSession().finally(() => setLoading(false));
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        const restored = await restoreDemoSession();
        if (restored) return;
        clearSession();
        setSession(null);
        setLoading(false);
        return;
      }
      try {
        const existing = loadSession();
        await refreshFromUser(user, existing?.orgId ?? null);
      } catch {
        clearSession();
        setSession(null);
        await firebaseSignOut(user.auth).catch(() => undefined);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      firebaseUser,
      loading,
      signInWithEmail: async (email, password) => {
        if (isDemoLogin(email, password)) {
          return refreshFromToken(DEMO_TOKEN, null);
        }
        const auth = firebaseAuth();
        if (!auth) throw new Error("Firebase is not configured");
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        return refreshFromUser(cred.user, null);
      },
      signUpWithEmail: async (name, email, password) => {
        const auth = firebaseAuth();
        if (!auth) throw new Error("Firebase is not configured");
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
        return refreshFromUser(cred.user, null);
      },
      startTrial: async ({ companyName, ownerName, email, password }) => {
        const res = await fetch(`${API_URL}/api/v1/auth/trial-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: companyName,
            owner_name: ownerName,
            email,
            password,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new ApiError(body?.error?.message || "Trial signup failed", res.status, body?.error?.code);
        }
        const auth = firebaseAuth();
        if (auth) {
          try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            return refreshFromUser(cred.user, body.orgId ?? null);
          } catch {
            // API may be in ATHENA_AUTH=dev while the browser still has Firebase config.
            return refreshFromToken(`dev:${body.uid}`, body.orgId ?? null);
          }
        }
        return refreshFromToken(`dev:${body.uid}`, body.orgId ?? null);
      },
      signInWithGoogle: async () => {
        const auth = firebaseAuth();
        if (!auth) throw new Error("Firebase is not configured");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(auth, provider);
        return refreshFromUser(cred.user, null);
      },
      setOrg: async (orgId: string) => {
        const existing = loadSession();
        if (existing?.accessToken?.startsWith("dev:")) {
          await refreshFromToken(existing.accessToken, orgId);
          return;
        }
        if (!firebaseAuth()?.currentUser) return;
        await refreshFromUser(firebaseAuth()!.currentUser!, orgId);
      },
      signOut: hardSignOut,
      refresh: async () => {
        const existing = loadSession();
        if (existing?.accessToken?.startsWith("dev:")) {
          await refreshFromToken(existing.accessToken, existing.orgId ?? null);
          return;
        }
        const user = firebaseAuth()?.currentUser;
        if (!user) return;
        await refreshFromUser(user, existing?.orgId ?? null);
      },
      getAccessToken: () => getIdToken(),
    }),
    [session, firebaseUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
