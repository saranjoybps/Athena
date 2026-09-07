export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string; orgId?: string } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  if (opts.orgId) headers.set("X-Organization-Id", opts.orgId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers,
      signal: opts.signal ?? controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("API timed out — is the server running on :8080?");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export function devToken(uid = "local-owner"): string {
  return `dev:${uid}`;
}
