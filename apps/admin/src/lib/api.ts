export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.error?.message || `Request failed (${res.status})`, res.status, body?.error?.code);
  }
  return body as T;
}

export const platform = {
  tenants: (token: string) => api<{ items: Tenant[] }>("/api/v1/platform/tenants", { token }),
  tenant: (token: string, id: string) => api<TenantDetail>(`/api/v1/platform/tenants/${id}`, { token }),
  createTenant: (token: string, body: unknown) =>
    api("/api/v1/platform/tenants", { method: "POST", token, body: JSON.stringify(body) }),
  patchTenant: (token: string, id: string, body: unknown) =>
    api(`/api/v1/platform/tenants/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  suspend: (token: string, id: string) =>
    api(`/api/v1/platform/tenants/${id}/suspend`, { method: "POST", token }),
  reactivate: (token: string, id: string) =>
    api(`/api/v1/platform/tenants/${id}/reactivate`, { method: "POST", token }),
  convert: (token: string, id: string, body: unknown) =>
    api(`/api/v1/platform/tenants/${id}/convert`, { method: "POST", token, body: JSON.stringify(body) }),
  extendTrial: (token: string, id: string, days = 15) =>
    api(`/api/v1/platform/tenants/${id}/extend-trial`, {
      method: "POST",
      token,
      body: JSON.stringify({ days }),
    }),
  users: (token: string, id: string) =>
    api<{ items: TenantUser[] }>(`/api/v1/platform/tenants/${id}/users`, { token }),
  createUser: (token: string, id: string, body: unknown) =>
    api(`/api/v1/platform/tenants/${id}/users`, { method: "POST", token, body: JSON.stringify(body) }),
  upgradeRequests: (token: string, status = "pending") =>
    api<{ items: UpgradeRequest[]; pending_count: number }>(
      `/api/v1/platform/upgrade-requests?status=${encodeURIComponent(status)}`,
      { token },
    ),
  acceptUpgrade: (token: string, id: string) =>
    api(`/api/v1/platform/upgrade-requests/${id}/accept`, { method: "POST", token }),
  rejectUpgrade: (token: string, id: string) =>
    api(`/api/v1/platform/upgrade-requests/${id}/reject`, { method: "POST", token }),
  settings: (token: string) => api<Record<string, unknown>>("/api/v1/platform/settings", { token }),
  saveSettings: (token: string, body: unknown) =>
    api("/api/v1/platform/settings", { method: "PUT", token, body: JSON.stringify(body) }),
};

export type Tenant = {
  id: string;
  name: string;
  status: string;
  plan: string;
  owner_email: string;
  trial_ends_at?: string | null;
  days_remaining?: number | null;
  quota_enforced?: boolean;
  upgrade_request_pending?: boolean;
  usage?: { users?: number; customers?: number; sites?: number };
  limits?: { users?: number; customers?: number; sites?: number };
  rate_limits?: Record<string, number>;
  notes?: string;
};

export type TenantDetail = Tenant & {
  upgrade_request?: UpgradeRequest | null;
};

export type TenantUser = {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  status?: string;
};

export type UpgradeRequest = {
  id: string;
  org_id: string;
  org_name?: string;
  owner_email?: string;
  status: string;
  message?: string;
  createdAt?: string;
};
