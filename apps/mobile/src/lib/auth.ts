import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/store";
import apiClient from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
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
  Toast.show({ type: "error", text1: "Your trial has ended", text2: "Request an upgrade or contact Athena admin." });
}

async function loadMe(): Promise<SessionUser> {
  const { data } = await apiClient.get<MeResponse>("/me");
  const session = await sessionFromMe(data);
  if (session.entitlements?.trial_expired) {
    // Allow session so upgrade-request can still be filed; UI shows expired state.
    return session;
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

/** Create Firebase account only — business + 15-day trial are created in onboarding. */
export async function signUpWithEmail(name: string, email: string, password: string): Promise<SessionUser> {
  const { setUser, setLoading } = useAuthStore.getState();
  setLoading(true);
  try {
    const auth = firebaseAuth();
    if (!auth) throw Object.assign(new Error("Firebase is not configured"), { userMessage: "Firebase is not configured" });
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    const session: SessionUser = {
      userId: cred.user.uid,
      email: cred.user.email || email.trim(),
      orgId: null,
      roles: [],
      permissions: [],
    };
    setUser(session);
    return session;
  } catch (e) {
    setUser(null);
    throw e;
  } finally {
    setLoading(false);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) throw Object.assign(new Error("Firebase is not configured"), { userMessage: "Firebase is not configured" });
  const trimmed = email.trim();
  if (!trimmed) throw Object.assign(new Error("Email required"), { userMessage: "Enter your email first" });
  await sendPasswordResetEmail(auth, trimmed);
}

export async function deleteAccount(): Promise<void> {
  await apiClient.delete("/me/account");
  await signOut();
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
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Auth user may already be deleted server-side.
    }
  }
}
