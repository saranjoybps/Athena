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

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string; orgId?: string } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  if (opts.orgId) headers.set("X-Organization-Id", opts.orgId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers,
      signal: opts.signal ?? controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = body?.error?.code as string | undefined;
      throw new ApiError(body?.error?.message || `Request failed (${res.status})`, res.status, code);
    }
    return body as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("API timed out — is the server running on :8000?");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
