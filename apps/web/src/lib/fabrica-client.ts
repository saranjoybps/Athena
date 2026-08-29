import { loadSession, devToken } from "@/lib/session";
import { api } from "@/lib/api";

export type Paginated<T> = { items: T[] };

export async function apiAuthed<T>(path: string, init: RequestInit = {}) {
  const session = loadSession();
  if (!session) throw new Error("Not signed in");
  return api<T>(path, {
    ...init,
    token: devToken(session.userId),
    orgId: session.orgId ?? undefined,
  });
}

export const fabrica = {
  me: () => apiAuthed("/api/v1/me"),
  dashboard: () => apiAuthed("/api/v1/reports/dashboard"),
  customers: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/customers"),
    create: (body: unknown) => apiAuthed("/api/v1/customers", { method: "POST", body: JSON.stringify(body) }),
  },
  sites: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/sites"),
    create: (body: unknown) => apiAuthed("/api/v1/sites", { method: "POST", body: JSON.stringify(body) }),
  },
  surveys: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/surveys"),
    create: (body: unknown) => apiAuthed("/api/v1/surveys", { method: "POST", body: JSON.stringify(body) }),
  },
  measurements: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/measurements"),
    create: (body: unknown) => apiAuthed("/api/v1/measurements", { method: "POST", body: JSON.stringify(body) }),
  },
  estimates: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/estimates"),
    create: (body: unknown) => apiAuthed("/api/v1/estimates", { method: "POST", body: JSON.stringify(body) }),
  },
  quotes: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/quotes"),
    get: (id: string) => apiAuthed<Record<string, unknown>>(`/api/v1/quotes/${id}`),
    create: (body: unknown) => apiAuthed("/api/v1/quotes", { method: "POST", body: JSON.stringify(body) }),
    send: (id: string) => apiAuthed(`/api/v1/quotes/${id}/send`, { method: "POST" }),
    accept: (id: string) => apiAuthed(`/api/v1/quotes/${id}/accept`, { method: "POST", body: "{}" }),
    reject: (id: string) => apiAuthed(`/api/v1/quotes/${id}/reject`, { method: "POST", body: "{}" }),
  },
  projects: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/projects"),
    fromQuote: (body: unknown) => apiAuthed("/api/v1/projects/from-quote", { method: "POST", body: JSON.stringify(body) }),
  },
  invoices: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/invoices"),
    get: (id: string) => apiAuthed<Record<string, unknown>>(`/api/v1/invoices/${id}`),
    create: (body: unknown, key: string) =>
      apiAuthed("/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": key },
      }),
    fromQuote: (quoteId: string, body: unknown, key: string) =>
      apiAuthed(`/api/v1/invoices/from-quote/${quoteId}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": key },
      }),
    send: (id: string) => apiAuthed(`/api/v1/invoices/${id}/send`, { method: "POST" }),
  },
  organization: {
    documentBranding: () => apiAuthed<Record<string, unknown>>("/api/v1/organizations/current/document-branding"),
    updateDocumentBranding: (body: unknown) =>
      apiAuthed("/api/v1/organizations/current/document-branding", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  payments: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/payments"),
    create: (body: unknown, key: string) =>
      apiAuthed("/api/v1/payments", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": key },
      }),
  },
  materials: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/materials"),
    create: (body: unknown) => apiAuthed("/api/v1/materials", { method: "POST", body: JSON.stringify(body) }),
  },
  suppliers: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/suppliers"),
    create: (body: unknown) => apiAuthed("/api/v1/suppliers", { method: "POST", body: JSON.stringify(body) }),
  },
  labour: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/labour"),
    create: (body: unknown) => apiAuthed("/api/v1/labour", { method: "POST", body: JSON.stringify(body) }),
  },
  expenses: {
    list: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/expenses"),
    create: (body: unknown) => apiAuthed("/api/v1/expenses", { method: "POST", body: JSON.stringify(body) }),
  },
  attendance: {
    create: (body: unknown) => apiAuthed("/api/v1/attendance", { method: "POST", body: JSON.stringify(body) }),
  },
  portal: {
    projects: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/portal/projects"),
    quotes: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/portal/quotes"),
    invoices: () => apiAuthed<Paginated<Record<string, unknown>>>("/api/v1/portal/invoices"),
  },
  search: (q: string) => apiAuthed<{ items: Array<Record<string, unknown>> }>(`/api/v1/search?q=${encodeURIComponent(q)}`),
  onboarding: (body: unknown, userId: string) =>
    api("/api/v1/onboarding", { method: "POST", body: JSON.stringify(body), token: devToken(userId) }),
};
