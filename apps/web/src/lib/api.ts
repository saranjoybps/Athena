export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string; orgId?: string } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  if (opts.orgId) headers.set("X-Organization-Id", opts.orgId);
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function devToken(uid = "local-owner"): string {
  return `dev:${uid}`;
}
