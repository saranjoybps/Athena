import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/store";
import apiClient from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import { getApiBaseUrl } from "@/lib/config";
import type { Entitlements } from "@/lib/entitlements";
import type { SessionUser } from "@/types";

type MeResponse = {
  userId: string;
  email?: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  memberships?: Array<{ organization: { id: string; name: string }; roles: string[] }>;
  entitlements?: Entitlements | null;
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
    entitlements: data.entitlements,
  };
}

export async function lockTrialExpired() {
  await signOut();
  Toast.show({ type: "error", text1: "Your trial has ended", text2: "Sign in after an upgrade." });
}

async function loadMe(): Promise<SessionUser> {
  const { data } = await apiClient.get<MeResponse>("/me");
  const session = await sessionFromMe(data);
  if (session.entitlements?.trial_expired) {
    await lockTrialExpired();
    throw Object.assign(new Error("Your trial has ended"), { code: "trial_expired", userMessage: "Your trial has ended" });
  }
  return session;
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
  return startTrial({ companyName: `${name.trim()}'s company`, ownerName: name, email, password });
}

export async function startTrial(input: {
  companyName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<SessionUser> {
  const { setUser, setLoading } = useAuthStore.getState();
  setLoading(true);
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/trial-signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: input.companyName,
        owner_name: input.ownerName,
        email: input.email,
        password: input.password,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(body?.error?.message || "Trial signup failed"), {
        userMessage: body?.error?.message || "Trial signup failed",
      });
    }
    const auth = firebaseAuth();
    if (!auth) throw Object.assign(new Error("Firebase is not configured"), { userMessage: "Firebase is not configured" });
    await signInWithEmailAndPassword(auth, input.email.trim(), input.password);
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

export async function requestUpgrade(message = "") {
  const { data } = await apiClient.post("/tenants/me/upgrade-request", { message });
  return data;
}

export async function signOut() {
  const auth = firebaseAuth();
  useAuthStore.getState().clear();
  if (auth) await firebaseSignOut(auth);
}
