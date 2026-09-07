import { useAuthStore } from "@/store";
import apiClient from "@/lib/api";
import type { SessionUser } from "@/types";

type MeResponse = {
  userId: string;
  email?: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  memberships?: Array<{ organization: { id: string; name: string }; roles: string[] }>;
};

export async function signInDev(userId = "local-owner"): Promise<SessionUser> {
  const { setUser, setLoading } = useAuthStore.getState();
  setLoading(true);
  try {
    // Temporary session so interceptor attaches Bearer token
    setUser({ userId, orgId: null, roles: [], permissions: [] });
    const { data } = await apiClient.get<MeResponse>("/me");
    const membership = data.memberships?.[0];
    const session: SessionUser = {
      userId: data.userId,
      email: data.email,
      orgId: data.orgId ?? membership?.organization.id ?? null,
      roles: data.roles?.length ? data.roles : membership?.roles ?? ["owner"],
      permissions: data.permissions?.length ? data.permissions : ["*"],
      businessName: membership?.organization.name,
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

export function signOut() {
  useAuthStore.getState().clear();
}
