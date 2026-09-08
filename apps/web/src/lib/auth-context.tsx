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
import { api } from "@/lib/api";
import { clearSession, loadSession, saveSession, type Session } from "@/lib/session";
import { firebaseAuth, getIdToken } from "@/lib/firebase";

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
  firebaseUser: User | null;
  /** True only during initial session restore — do not block login UI on this. */
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<Session>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<Session>;
  signInWithGoogle: () => Promise<Session>;
  setOrg: (orgId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(token: string, orgId?: string | null): Promise<MeResponse> {
  return api<MeResponse>("/api/v1/me", {
    token,
    orgId: orgId ?? undefined,
  });
}

function sessionFromMe(me: MeResponse, currentOrgId?: string | null): Session {
  const membership = me.memberships?.[0];
  const membershipOrgId = membership?.organization?.id;
  return {
    userId: me.userId,
    orgId: me.orgId ?? membershipOrgId ?? currentOrgId ?? null,
    orgName: membership?.organization?.name,
    email: me.email,
    roles: me.roles?.length ? me.roles : membership?.roles ?? [],
    permissions: me.permissions ?? [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshFromUser = async (user: User, orgId?: string | null) => {
    const token = await user.getIdToken();
    let me: MeResponse;
    try {
      me = await fetchMe(token, orgId);
    } catch {
      me = await fetchMe(token, null);
    }
    const next = sessionFromMe(me, orgId);
    saveSession(next);
    setSession(next);
    return next;
  };

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        clearSession();
        setSession(null);
        setLoading(false);
        return;
      }
      try {
        const existing = loadSession();
        await refreshFromUser(user, existing?.orgId ?? null);
      } catch {
        // Authenticated in Firebase but API unreachable — keep a minimal session
        const minimal: Session = {
          userId: user.uid,
          orgId: null,
          email: user.email ?? undefined,
          roles: [],
          permissions: [],
        };
        saveSession(minimal);
        setSession(minimal);
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
      signInWithGoogle: async () => {
        const auth = firebaseAuth();
        if (!auth) throw new Error("Firebase is not configured");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(auth, provider);
        return refreshFromUser(cred.user, null);
      },
      setOrg: async (orgId: string) => {
        if (!firebaseAuth()?.currentUser) return;
        await refreshFromUser(firebaseAuth()!.currentUser!, orgId);
      },
      signOut: async () => {
        const auth = firebaseAuth();
        clearSession();
        setSession(null);
        if (auth) await firebaseSignOut(auth);
      },
      refresh: async () => {
        const user = firebaseAuth()?.currentUser;
        if (!user) return;
        await refreshFromUser(user, loadSession()?.orgId ?? null);
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
