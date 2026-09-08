import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { useAuthStore } from "@/store";
import apiClient from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import type { SessionUser } from "@/types";

type MeResponse = {
  userId: string;
  email?: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  memberships?: Array<{ organization: { id: string; name: string }; roles: string[] }>;
};

async function sessionFromMe(data: MeResponse): Promise<SessionUser> {
  const membership = data.memberships?.[0];
  return {
    userId: data.userId,
    email: data.email,
    orgId: data.orgId ?? membership?.organization.id ?? null,
    roles: data.roles?.length ? data.roles : membership?.roles ?? [],
    permissions: data.permissions?.length ? data.permissions : [],
    businessName: membership?.organization.name,
  };
}

async function loadMe(): Promise<SessionUser> {
  const { data } = await apiClient.get<MeResponse>("/me");
  return sessionFromMe(data);
}

export async function signInWithEmail(email: string, password: string): Promise<SessionUser> {
  const { setUser, setLoading } = useAuthStore.getState();
  setLoading(true);
  try {
    const auth = firebaseAuth();
    if (!auth) throw Object.assign(new Error("Firebase is not configured"), { userMessage: "Firebase is not configured" });
    await signInWithEmailAndPassword(auth, email.trim(), password);
    const session = await loadMe();
    setUser(session);
    return session;
  } catch (e) {
    setUser(null);
    throw e;
  } finally {
    setLoading(false);
  }
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<SessionUser> {
  const { setUser, setLoading } = useAuthStore.getState();
  setLoading(true);
  try {
    const auth = firebaseAuth();
    if (!auth) throw Object.assign(new Error("Firebase is not configured"), { userMessage: "Firebase is not configured" });
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    const session = await loadMe();
    setUser(session);
    return session;
  } catch (e) {
    setUser(null);
    throw e;
  } finally {
    setLoading(false);
  }
}

export async function refreshSession(): Promise<SessionUser | null> {
  const auth = firebaseAuth();
  if (!auth?.currentUser) return null;
  const session = await loadMe();
  useAuthStore.getState().setUser(session);
  return session;
}

export async function completeOnboarding(body: Record<string, unknown>): Promise<SessionUser> {
  await apiClient.post("/onboarding", body);
  const session = await loadMe();
  useAuthStore.getState().setUser(session);
  return session;
}

export async function signOut() {
  const auth = firebaseAuth();
  useAuthStore.getState().clear();
  if (auth) await firebaseSignOut(auth);
}
