import { loadSession } from "@/lib/session";
import { api } from "@/lib/api";
import { getIdToken } from "@/lib/firebase";

export type Paginated<T> = { items: T[] };

export async function apiAuthed<T>(path: string, init: RequestInit = {}) {
  const session = loadSession();
  if (!session) throw new Error("Not signed in");
  const token = await getIdToken();
  if (!token) throw new Error("Not signed in");
  return api<T>(path, {
    ...init,
    token,
    orgId: session.orgId ?? undefined,
  });
}

function patch(path: string, body: unknown) {
  return apiAuthed(path, { method: "PATCH", body: JSON.stringify(body) });
}

function post(path: string, body?: unknown, headers?: Record<string, string>) {
  return apiAuthed(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
}

function list(path: string) {
  return apiAuthed<Paginated<Record<string, unknown>>>(path);
}

function get(path: string) {
  return apiAuthed<Record<string, unknown>>(path);
}

function crud(base: string) {
  return {
    list: () => list(base),
    get: (id: string) => get(`${base}/${id}`),
    create: (body: unknown) => post(base, body),
    update: (id: string, body: unknown) => patch(`${base}/${id}`, body),
  };
}

export const athena = {
  me: () => apiAuthed("/api/v1/me"),
  dashboard: () => apiAuthed<Record<string, unknown>>("/api/v1/reports/dashboard"),
  accounts: () => apiAuthed<Record<string, unknown>>("/api/v1/reports/accounts"),
  gst: () => apiAuthed<Record<string, unknown>>("/api/v1/reports/gst"),
  projectProfitability: (projectId: string) =>
    apiAuthed<Record<string, unknown>>(`/api/v1/reports/project-profitability/${projectId}`),
  customers: {
    ...crud("/api/v1/customers"),
    summary: (id: string) => apiAuthed<Record<string, unknown>>(`/api/v1/customers/${id}/summary`),
    followUps: (id: string) => list(`/api/v1/customers/${id}/follow-ups`),
    addFollowUp: (id: string, body: unknown) => post(`/api/v1/customers/${id}/follow-ups`, body),
    completeFollowUp: (followUpId: string) => post(`/api/v1/customers/follow-ups/${followUpId}/complete`),
  },
  sites: {
    ...crud("/api/v1/sites"),
    list: (customerId?: string) =>
      list(customerId ? `/api/v1/sites?customer_id=${encodeURIComponent(customerId)}` : "/api/v1/sites"),
    files: {
      list: (siteId: string) => list(`/api/v1/sites/${siteId}/files`),
      create: (siteId: string, body: unknown) => post(`/api/v1/sites/${siteId}/files`, body),
      remove: (siteId: string, fileId: string) =>
        apiAuthed(`/api/v1/sites/${siteId}/files/${fileId}`, { method: "DELETE" }),
    },
  },
  surveys: {
    list: (siteId?: string) =>
      list(siteId ? `/api/v1/surveys?site_id=${encodeURIComponent(siteId)}` : "/api/v1/surveys"),
    get: (id: string) => get(`/api/v1/surveys/${id}`),
    create: (body: unknown) => post("/api/v1/surveys", body),
    update: (id: string, body: unknown) => patch(`/api/v1/surveys/${id}`, body),
  },
  measurements: {
    list: (siteId?: string) =>
      list(siteId ? `/api/v1/measurements?site_id=${encodeURIComponent(siteId)}` : "/api/v1/measurements"),
    get: (id: string) => get(`/api/v1/measurements/${id}`),
    create: (body: unknown) => post("/api/v1/measurements", body),
    update: (id: string, body: unknown) => patch(`/api/v1/measurements/${id}`, body),
  },
  quotes: {
    list: () => list("/api/v1/quotes"),
    get: (id: string) => get(`/api/v1/quotes/${id}`),
    create: (body: unknown) => post("/api/v1/quotes", body),
    update: (id: string, body: unknown) => patch(`/api/v1/quotes/${id}`, body),
    send: (id: string) => post(`/api/v1/quotes/${id}/send`),
    accept: (id: string) => post(`/api/v1/quotes/${id}/accept`, {}),
    reject: (id: string) => post(`/api/v1/quotes/${id}/reject`, {}),
    pdf: (id: string) => post(`/api/v1/quotes/${id}/pdf`),
  },
  estimates: {
    list: () => list("/api/v1/estimates"),
    get: (id: string) => get(`/api/v1/estimates/${id}`),
    create: (body: unknown) => post("/api/v1/estimates", body),
    revise: (id: string, body: unknown) => post(`/api/v1/estimates/${id}/versions`, body),
    pdf: (id: string) => post(`/api/v1/estimates/${id}/pdf`),
  },
  projects: {
    list: () => list("/api/v1/projects"),
    get: (id: string) => get(`/api/v1/projects/${id}`),
    update: (id: string, body: unknown) => patch(`/api/v1/projects/${id}`, body),
    fromQuote: (body: unknown) => post("/api/v1/projects/from-quote", body),
    close: (id: string) => post(`/api/v1/projects/${id}/close`),
  },
  invoices: {
    list: () => list("/api/v1/invoices"),
    get: (id: string) => get(`/api/v1/invoices/${id}`),
    update: (id: string, body: unknown) => patch(`/api/v1/invoices/${id}`, body),
    create: (body: unknown, key: string) => post("/api/v1/invoices", body, { "Idempotency-Key": key }),
    fromQuote: (quoteId: string, body: unknown, key: string) =>
      post(`/api/v1/invoices/from-quote/${quoteId}`, body, { "Idempotency-Key": key }),
    send: (id: string) => post(`/api/v1/invoices/${id}/send`),
    pdf: (id: string) => post(`/api/v1/invoices/${id}/pdf`),
  },
  organization: {
    documentBranding: () => get("/api/v1/organizations/current/document-branding"),
    updateDocumentBranding: (body: unknown) => patch("/api/v1/organizations/current/document-branding", body),
  },
  payments: {
    list: () => list("/api/v1/payments"),
    create: (body: unknown, key: string) => post("/api/v1/payments", body, { "Idempotency-Key": key }),
  },
  materials: crud("/api/v1/materials"),
  suppliers: crud("/api/v1/suppliers"),
  labour: crud("/api/v1/labour"),
  crews: crud("/api/v1/crews"),
  vehicles: crud("/api/v1/vehicles"),
  inventory: crud("/api/v1/inventory"),
  stock: {
    summary: () => apiAuthed<{ items: Record<string, unknown>[] }>("/api/v1/stock/summary"),
  },
  deliveryChallans: {
    list: () => list("/api/v1/delivery-challans"),
    get: (id: string) => get(`/api/v1/delivery-challans/${id}`),
    create: (body: unknown) => post("/api/v1/delivery-challans", body),
    update: (id: string, body: unknown) => patch(`/api/v1/delivery-challans/${id}`, body),
    pdf: (id: string) => post(`/api/v1/delivery-challans/${id}/pdf`),
  },
  documents: crud("/api/v1/documents"),
  expenses: {
    list: (projectId?: string) =>
      list(projectId ? `/api/v1/expenses?project_id=${encodeURIComponent(projectId)}` : "/api/v1/expenses"),
    get: (id: string) => get(`/api/v1/expenses/${id}`),
    create: (body: unknown) => post("/api/v1/expenses", body),
    update: (id: string, body: unknown) => patch(`/api/v1/expenses/${id}`, body),
  },
  reports: {
    measurements: () => apiAuthed<Record<string, unknown>>("/api/v1/reports/measurements"),
    inventory: () => apiAuthed<{ items: Record<string, unknown>[] }>("/api/v1/reports/inventory"),
    dailyExpenses: () => apiAuthed<Record<string, unknown>>("/api/v1/reports/daily-expenses"),
    gstr1: () => apiAuthed<{ items: Record<string, unknown>[]; count?: number }>("/api/v1/reports/gstr1"),
    gstr2b: () => apiAuthed<{ items: Record<string, unknown>[]; count?: number }>("/api/v1/reports/gstr2b"),
  },
  attendance: {
    list: () => list("/api/v1/attendance"),
    create: (body: unknown) => post("/api/v1/attendance", body),
  },
  changeOrders: {
    list: () => list("/api/v1/change-orders"),
    create: (body: unknown) => post("/api/v1/change-orders", body),
    send: (id: string) => post(`/api/v1/change-orders/${id}/send`),
    approve: (id: string) => post(`/api/v1/change-orders/${id}/approve`),
    reject: (id: string) => post(`/api/v1/change-orders/${id}/reject`),
  },
  snags: {
    list: () => list("/api/v1/snags"),
    create: (body: unknown) => post("/api/v1/snags", body),
    assign: (id: string, body: unknown) => post(`/api/v1/snags/${id}/assign`, body),
    resolve: (id: string) => post(`/api/v1/snags/${id}/resolve`),
    verify: (id: string) => post(`/api/v1/snags/${id}/verify`),
  },
  schedules: {
    list: () => list("/api/v1/project-schedules"),
    create: (body: unknown) => post("/api/v1/project-schedules", body),
  },
  photos: {
    list: () => list("/api/v1/photos"),
    create: (body: unknown) => post("/api/v1/photos", body),
  },
  materialRequests: {
    list: () => list("/api/v1/material-requests"),
    create: (body: unknown) => post("/api/v1/material-requests", body),
    approve: (id: string) => post(`/api/v1/material-requests/${id}/approve`),
  },
  purchaseOrders: {
    list: () => list("/api/v1/purchase-orders"),
    create: (body: unknown) => post("/api/v1/purchase-orders", body),
    receive: (id: string) => post(`/api/v1/purchase-orders/${id}/receive`),
  },
  users: {
    list: () => list("/api/v1/users"),
    invite: (body: unknown) => post("/api/v1/users/invite", body),
    update: (id: string, body: unknown) => patch(`/api/v1/users/${id}`, body),
  },
  requestUpgrade: (message = "") => post("/api/v1/tenants/me/upgrade-request", { message }),
  getUpgradeRequest: () => apiAuthed<{ item: Record<string, unknown> | null }>("/api/v1/tenants/me/upgrade-request"),
  accounting: {
    list: () => list("/api/v1/accounting-entries"),
  },
  portal: {
    projects: () => list("/api/v1/portal/projects"),
    quotes: () => list("/api/v1/portal/quotes"),
    invoices: () => list("/api/v1/portal/invoices"),
  },
  search: (q: string) => apiAuthed<{ items: Array<Record<string, unknown>> }>(`/api/v1/search?q=${encodeURIComponent(q)}`),
  onboarding: (body: unknown) => post("/api/v1/onboarding", body),
};

export async function optionsFrom(
  loader: () => Promise<Paginated<Record<string, unknown>>>,
  labelKeys: string[] = ["name", "number", "title"],
) {
  const res = await loader();
  return res.items.map((item) => {
    const label =
      labelKeys.map((k) => item[k]).find((v) => v != null && String(v).trim()) ??
      item.id;
    return { value: String(item.id), label: String(label) };
  });
}
