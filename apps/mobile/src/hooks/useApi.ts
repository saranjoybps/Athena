import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { PeriodReport } from "@/lib/reportPeriod";
import { useAuthStore } from "@/store";
import type { AthenaRecord, Paginated } from "@/types";

type ListParams = Record<string, string | number | undefined>;

/** Queries should wait until cold-start auth has finished and an org is present. */
function useAuthedQueryEnabled(extra = true) {
  return useAuthStore((s) => !s.isLoading && Boolean(s.user?.orgId)) && extra;
}

async function list<T>(path: string, params?: ListParams) {
  const { data } = await apiClient.get<Paginated<T>>(path, { params });
  return data;
}

async function get<T>(path: string) {
  const { data } = await apiClient.get<T>(path);
  return data;
}

async function post<T>(path: string, body?: unknown, headers?: Record<string, string>) {
  const { data } = await apiClient.post<T>(path, body ?? {}, { headers });
  return data;
}

async function patch<T>(path: string, body?: unknown) {
  const { data } = await apiClient.patch<T>(path, body ?? {});
  return data;
}

type DetailResource =
  | "sites"
  | "projects"
  | "quotes"
  | "invoices"
  | "estimates"
  | "inventory"
  | "materials"
  | "labour"
  | "crews"
  | "surveys"
  | "delivery-challans"
  | "expenses"
  | "measurements"
  | "payments";

/** Single-record query shared by detail hooks and list-row prefetch so both hit the same cache entry. */
function detailQuery(resource: DetailResource, id?: string) {
  // Filtered list keys for these are [resource, filter], so detail keys carry a "detail" segment.
  const queryKey: QueryKey =
    resource === "expenses" || resource === "measurements" ? [resource, "detail", id] : [resource, id];
  return { queryKey, queryFn: () => get<AthenaRecord>(`/${resource}/${id}`) };
}

/** Starts a detail request when a list row is tapped; the detail hook dedupes onto it. */
export function usePrefetchDetail() {
  const qc = useQueryClient();
  return (resource: DetailResource, id: unknown) => {
    if (id == null || id === "") return;
    qc.prefetchQuery(detailQuery(resource, String(id)));
  };
}

/**
 * Row from a cached list response, shown while the detail request runs.
 * Only for resources whose detail endpoint returns the same document as the list
 * and whose screens re-sync from `data`; one-shot form hydration must not use it.
 */
function cachedListRow(qc: QueryClient, listKey: QueryKey, id?: string) {
  if (!id) return undefined;
  return qc.getQueryData<Paginated<AthenaRecord>>(listKey)?.items?.find((row) => String(row.id) === id);
}

function invalidateCustomerHub(qc: ReturnType<typeof useQueryClient>, customerId?: unknown) {
  qc.invalidateQueries({ queryKey: ["customers"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["reports", "period"] });
  if (customerId) {
    const id = String(customerId);
    qc.invalidateQueries({ queryKey: ["customers", id] });
    qc.invalidateQueries({ queryKey: ["customers", id, "summary"] });
  }
}

export function useMe(enabled = true) {
  const signedIn = useAuthStore((s) => !s.isLoading && Boolean(s.user));
  return useQuery({
    queryKey: ["me"],
    queryFn: () => get<Record<string, unknown>>("/me"),
    enabled: signedIn && enabled,
  });
}

export function useDashboard(enabled = true) {
  const ready = useAuthedQueryEnabled(enabled);
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<Record<string, unknown>>("/reports/dashboard"),
    enabled: ready,
  });
}

export function useCustomers(enabled = true) {
  const ready = useAuthedQueryEnabled(enabled);
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => list<AthenaRecord>("/customers"),
    enabled: ready,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/customers", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => get<AthenaRecord>(`/customers/${id}`),
    enabled: Boolean(id),
  });
}

function customerSummaryQuery(id?: string) {
  return {
    queryKey: ["customers", id, "summary"],
    queryFn: () => get<Record<string, unknown>>(`/customers/${id}/summary`),
  };
}

export function useCustomerSummary(id?: string) {
  return useQuery({ ...customerSummaryQuery(id), enabled: Boolean(id) });
}

/** Starts the hub request before the screen mounts; useCustomerSummary dedupes onto the in-flight fetch. */
export function usePrefetchCustomerSummary() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.prefetchQuery(customerSummaryQuery(id));
  };
}

/** Row from the cached customers list, used as a header placeholder while the hub loads. */
export function useCachedCustomer(id?: string) {
  const qc = useQueryClient();
  if (!id) return undefined;
  return qc.getQueryData<Paginated<AthenaRecord>>(["customers"])?.items?.find((c) => String(c.id) === id);
}

export function useAddFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, note, dueAt }: { customerId: string; note: string; dueAt?: string | null }) =>
      post<AthenaRecord>(`/customers/${customerId}/follow-ups`, { note, dueAt: dueAt || null }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customers", vars.customerId, "summary"] });
    },
  });
}

export function useCompleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ followUpId, customerId }: { followUpId: string; customerId: string }) =>
      post<AthenaRecord>(`/customers/follow-ups/${followUpId}/complete`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customers", vars.customerId, "summary"] });
    },
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => get<Record<string, unknown>>("/reports/accounts"),
  });
}

export function useReportPeriod(mode: "month" | "year", year: number, month: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["reports", "period", mode, year, mode === "month" ? month : null],
    queryFn: async () => {
      const params = mode === "month" ? { mode, year, month } : { mode, year };
      const { data } = await apiClient.get<PeriodReport>("/reports/period", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/customers/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", vars.id] });
      qc.invalidateQueries({ queryKey: ["customers", vars.id, "summary"] });
    },
  });
}

export type DeleteResult = { ok: boolean; id: string; siteId?: string; customerId?: string; removed?: Record<string, number> };

async function remove(path: string) {
  const { data } = await apiClient.delete<DeleteResult>(path);
  return data;
}

/** Drops cached rows for a deleted record so mounted detail screens don't refetch into a 404. */
function forget(qc: QueryClient, ...keys: QueryKey[]) {
  for (const key of keys) qc.removeQueries({ queryKey: key });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remove(`/customers/${id}`),
    onSuccess: (_d, id) => {
      forget(qc, ["customers", id]);
      qc.invalidateQueries({ queryKey: ["customers"], exact: true });
      for (const key of ["sites", "surveys", "measurements", "estimates", "quotes", "dashboard"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remove(`/sites/${id}`),
    onSuccess: (data, id) => {
      forget(qc, ["sites", id]);
      qc.invalidateQueries({ queryKey: ["sites"], exact: true });
      for (const key of ["surveys", "measurements", "estimates", "quotes"]) qc.invalidateQueries({ queryKey: [key] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remove(`/surveys/${id}`),
    onSuccess: (data, id) => {
      forget(qc, ["surveys", id]);
      qc.invalidateQueries({ queryKey: ["surveys"] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remove(`/measurements/${id}`),
    onSuccess: (data, id) => {
      forget(qc, ["measurements", "detail", id]);
      qc.invalidateQueries({ queryKey: ["measurements"] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useDeleteEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remove(`/estimates/${id}`),
    onSuccess: (data, id) => {
      forget(qc, ["estimates", id]);
      qc.invalidateQueries({ queryKey: ["estimates"], exact: true });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export type PreviewPage = { page: number; width: number; height: number; mimeType: string; imageBase64: string };

/** Rasterised PDF pages. Lives under the estimate's key, so saving a revision refreshes it. */
export function useEstimatePreview(id?: string, version?: unknown, enabled = true) {
  return useQuery({
    queryKey: ["estimates", id, "preview", version ?? null],
    queryFn: () => get<{ pageCount: number; pages: PreviewPage[] }>(`/estimates/${id}/preview-pages`),
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60_000,
  });
}

export type EstimateWorkflow = {
  quote: { id: string; number?: string; status?: string; sentAt?: string; decidedAt?: string; pdfUrl?: string } | null;
  project: { id: string; name?: string; number?: string; status?: string; contractValue?: string } | null;
};

/** Linked quote + started project for one estimate (exact, unlike scanning the paginated quotes list). */
export function useEstimateWorkflow(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["quotes", "for-estimate", id],
    queryFn: () => get<EstimateWorkflow>(`/estimates/${id}/workflow`),
    enabled: Boolean(id) && enabled,
  });
}

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => list<AthenaRecord>("/sites"),
  });
}

export function useSite(id?: string) {
  const qc = useQueryClient();
  return useQuery({
    ...detailQuery("sites", id),
    enabled: Boolean(id),
    placeholderData: () => cachedListRow(qc, ["sites"], id),
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/sites/${id}`, body),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["sites", vars.id] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/sites", body),
    onSuccess: (data, body) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      invalidateCustomerHub(qc, data.customerId ?? body.customerId);
    },
  });
}

export function useSiteFiles(siteId?: string) {
  return useQuery({
    queryKey: ["sites", siteId, "files"],
    queryFn: () => list<AthenaRecord>(`/sites/${siteId}/files`),
    enabled: Boolean(siteId),
  });
}

export function useCreateSiteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, body }: { siteId: string; body: Record<string, unknown> }) =>
      post<AthenaRecord>(`/sites/${siteId}/files`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sites", vars.siteId, "files"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteSiteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ siteId, fileId }: { siteId: string; fileId: string }) => {
      await apiClient.delete(`/sites/${siteId}/files/${fileId}`);
      return { ok: true };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sites", vars.siteId, "files"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useProjects(enabled = true) {
  const ready = useAuthedQueryEnabled(enabled);
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => list<AthenaRecord>("/projects"),
    enabled: ready,
  });
}

export function useProject(id?: string) {
  const qc = useQueryClient();
  return useQuery({
    ...detailQuery("projects", id),
    enabled: Boolean(id),
    placeholderData: () => cachedListRow(qc, ["projects"], id),
  });
}

export function useBillingReview(id?: string) {
  return useQuery({
    queryKey: ["billing-review", id],
    queryFn: () => get<Record<string, unknown>>(`/projects/${id}/billing-review`),
    enabled: Boolean(id),
  });
}

export function useProjectProfitability(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["project-profitability", id],
    queryFn: () => get<Record<string, unknown>>(`/reports/project-profitability/${id}`),
    enabled: Boolean(id) && enabled,
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/projects/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean; id: string }>(`/projects/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"], exact: true });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      invalidateCustomerHub(qc);
    },
  });
}

export function useCreateProjectFromQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      quoteId: string;
      name?: string;
      startDate?: string;
      expectedCompletion?: string;
    }) => post<AthenaRecord>("/projects/from-quote", body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useEstimates() {
  return useQuery({
    queryKey: ["estimates"],
    queryFn: () => list<AthenaRecord>("/estimates"),
  });
}

export function useQuotes() {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: () => list<AthenaRecord>("/quotes"),
  });
}

export function useQuote(id?: string) {
  return useQuery({ ...detailQuery("quotes", id), enabled: Boolean(id) });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/quotes/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", vars.id] });
    },
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { estimateId: string; validityDays?: number; notes?: string }) =>
      post<AthenaRecord>("/quotes", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useQuoteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "send" | "accept" | "reject" | "request-modification" }) =>
      post<AthenaRecord>(`/quotes/${id}/${action}`, action === "send" ? undefined : {}),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", vars.id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useInvoices(enabled = true) {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: () => list<AthenaRecord>("/invoices"),
    enabled,
  });
}

/** Invoices of one project, filtered server-side so older projects aren't cut off by the org-wide list limit. */
export function useProjectInvoices(projectId?: string) {
  return useQuery({
    queryKey: ["invoices", "project", projectId],
    queryFn: () => list<AthenaRecord>("/invoices", { project_id: projectId }),
    enabled: Boolean(projectId),
  });
}

/** Payments for one invoice or one project. */
export function usePaymentsFor(scope: { invoiceId?: string; projectId?: string }) {
  const ready = useAuthedQueryEnabled(Boolean(scope.invoiceId || scope.projectId));
  return useQuery({
    queryKey: ["payments", "for", scope.invoiceId ? "invoice" : "project", scope.invoiceId || scope.projectId],
    queryFn: () =>
      list<AthenaRecord>("/payments", scope.invoiceId ? { invoice_id: scope.invoiceId } : { project_id: scope.projectId }),
    enabled: ready,
  });
}

export function useInvoice(id?: string) {
  return useQuery({ ...detailQuery("invoices", id), enabled: Boolean(id) });
}

/** Rasterised invoice PDF pages; keyed under the invoice so any invoice change refreshes them. */
export function useInvoicePreview(id?: string, updatedAt?: unknown, enabled = true) {
  return useQuery({
    queryKey: ["invoices", id, "preview", updatedAt ?? null],
    queryFn: () => get<{ pageCount: number; pages: PreviewPage[] }>(`/invoices/${id}/preview-pages`),
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/invoices/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", vars.id] });
    },
  });
}

export function useInvoiceFromQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) =>
      post<AthenaRecord>(
        `/invoices/from-quote/${quoteId}`,
        { kind: "final" },
        { "Idempotency-Key": `mobile-${quoteId}-${Date.now()}` },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useExpenses(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ["expenses", projectId || "all"],
    queryFn: () => list<AthenaRecord>("/expenses", projectId ? { project_id: projectId } : undefined),
    enabled,
  });
}

export function useExpense(id?: string) {
  return useQuery({ ...detailQuery("expenses", id), enabled: Boolean(id) });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/expenses/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses", "detail", vars.id] });
      qc.invalidateQueries({ queryKey: ["project-profitability"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean }>(`/expenses/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["project-profitability"] });
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      projectId: string;
      category: string;
      amount: string;
      description?: string;
      billableToCustomer?: boolean;
      paidBy?: string;
      budgetLineId?: string;
    }) => post<AthenaRecord>("/expenses", body),
    onSuccess: (_d, body) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["projects", body.projectId] });
      qc.invalidateQueries({ queryKey: ["project-profitability", body.projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports", "period"] });
    },
  });
}

export function useAttendance() {
  return useQuery({
    queryKey: ["attendance"],
    queryFn: () => list<AthenaRecord>("/attendance"),
  });
}

/** All marks for one project, filtered server-side (the org-wide list only holds the newest rows). */
export function useProjectAttendance(projectId?: string) {
  return useQuery({
    queryKey: ["attendance", "project", projectId],
    queryFn: () => list<AthenaRecord>("/attendance", { project_id: projectId }),
    enabled: Boolean(projectId),
  });
}

function invalidateAttendance(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["attendance"] });
  qc.invalidateQueries({ queryKey: ["reports", "period"] });
}

/** Marks a worker for a day; marking the same worker/project/day again updates the existing record. */
export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      projectId: string;
      status: string;
      overtimeHours?: string;
      crewId?: string;
      workerId?: string;
      date?: string;
      workDone?: { lineId: string; quantity: string; unit?: string; billingMethod?: string; description?: string }[];
    }) => post<AthenaRecord>("/attendance", body),
    onSuccess: () => invalidateAttendance(qc),
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      workDone,
    }: {
      id: string;
      status: string;
      workDone?: { lineId: string; quantity: string; unit?: string; billingMethod?: string; description?: string }[];
    }) => patch<AthenaRecord>(`/attendance/${id}`, { status, ...(workDone ? { workDone } : {}) }),
    onSuccess: () => invalidateAttendance(qc),
  });
}

export function useClearAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean }>(`/attendance/${id}`);
      return data;
    },
    onSuccess: () => invalidateAttendance(qc),
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: () => list<AthenaRecord>("/materials"),
  });
}

export function useMaterial(id?: string) {
  return useQuery({ ...detailQuery("materials", id), enabled: Boolean(id) });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/materials/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["materials", vars.id] });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
    },
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/materials", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean; id: string }>(`/materials/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"], exact: true });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => list<AthenaRecord>("/suppliers"),
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => get<AthenaRecord>(`/suppliers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/suppliers", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/suppliers/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["suppliers", vars.id] });
    },
  });
}

export function useLabour() {
  return useQuery({
    queryKey: ["labour"],
    queryFn: () => list<AthenaRecord>("/labour"),
  });
}

export function useLabourWorker(id?: string) {
  return useQuery({ ...detailQuery("labour", id), enabled: Boolean(id) });
}

export function useCreateLabour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/labour", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labour"] }),
  });
}

export function useUpdateLabour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/labour/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["labour"] });
      qc.invalidateQueries({ queryKey: ["labour", vars.id] });
      // Crew rosters carry member names, renamed server-side with the worker.
      qc.invalidateQueries({ queryKey: ["crews"] });
    },
  });
}

export function useDeleteLabour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean; id: string }>(`/labour/${id}`);
      return data;
    },
    // Exact: a prefix match would refetch the deleted record's still-mounted detail query and 404.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labour"], exact: true }),
  });
}

export function useCreateCrew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/crews", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crews"] }),
  });
}

export function useCrews() {
  return useQuery({
    queryKey: ["crews"],
    queryFn: () => list<AthenaRecord>("/crews"),
  });
}

export function useCrew(id?: string) {
  return useQuery({ ...detailQuery("crews", id), enabled: Boolean(id) });
}

export function useUpdateCrew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/crews/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crews"] });
      qc.invalidateQueries({ queryKey: ["crews", vars.id] });
    },
  });
}

export function useDeleteCrew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean; id: string }>(`/crews/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crews"], exact: true }),
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: ["project-schedules"],
    queryFn: () => list<AthenaRecord>("/project-schedules"),
  });
}

/** Schedules for one project, filtered server-side instead of from the org-wide (50-row) list. */
export function useProjectSchedules(projectId?: string) {
  return useQuery({
    queryKey: ["project-schedules", "project", projectId],
    queryFn: () => list<AthenaRecord>("/project-schedules", { project_id: projectId }),
    enabled: Boolean(projectId),
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/project-schedules", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-schedules"] });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { startDate?: string; endDate?: string; crewId?: string } }) =>
      patch<AthenaRecord>(`/project-schedules/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-schedules"] });
    },
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean }>(`/project-schedules/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-schedules"] });
    },
  });
}

export function useTools() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: () => list<AthenaRecord>("/inventory"),
  });
}

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/inventory", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["reports", "inventory"] });
    },
  });
}

export function useTool(id?: string) {
  return useQuery({ ...detailQuery("inventory", id), enabled: Boolean(id) });
}

export function useUpdateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/inventory/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory", vars.id] });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["reports", "inventory"] });
    },
  });
}

export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ ok: boolean; id: string }>(`/inventory/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"], exact: true });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["reports", "inventory"] });
    },
  });
}

export function usePayments(enabled = true) {
  const ready = useAuthedQueryEnabled(enabled);
  return useQuery({
    queryKey: ["payments"],
    queryFn: () => list<AthenaRecord>("/payments"),
    enabled: ready,
  });
}

export function usePayment(id?: string) {
  const qc = useQueryClient();
  return useQuery({
    ...detailQuery("payments", id),
    enabled: Boolean(id),
    placeholderData: () => cachedListRow(qc, ["payments"], id),
  });
}

/** A payment changes its invoice balance, the project's revenue/status and every money report. */
function invalidateAfterPayment(qc: ReturnType<typeof useQueryClient>, payment: { customerId?: unknown; projectId?: unknown; invoiceId?: unknown }) {
  qc.invalidateQueries({ queryKey: ["payments"] });
  qc.invalidateQueries({ queryKey: ["invoices"] });
  qc.invalidateQueries({ queryKey: ["projects"] });
  qc.invalidateQueries({ queryKey: ["accounts"] });
  if (payment.projectId) qc.invalidateQueries({ queryKey: ["project-profitability", String(payment.projectId)] });
  invalidateCustomerHub(qc, payment.customerId);
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { invoiceId: string; amount: string; method: string; reference?: string; notes?: string }) =>
      post<AthenaRecord>("/payments", body, { "Idempotency-Key": `pay-mobile-${Date.now()}` }),
    onSuccess: (data) => invalidateAfterPayment(qc, data),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { amount?: string; method?: string; reference?: string | null; notes?: string | null } }) =>
      patch<AthenaRecord>(`/payments/${id}`, body),
    onSuccess: (data) => invalidateAfterPayment(qc, data),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: AthenaRecord) => {
      const { data } = await apiClient.delete<{ ok: boolean; projectReopened?: boolean }>(`/payments/${payment.id}`);
      return data;
    },
    onSuccess: (_data, payment) => {
      // Exact list invalidation: the still-mounted detail query must not refetch into a 404.
      qc.invalidateQueries({ queryKey: ["payments"], exact: true });
      qc.invalidateQueries({ queryKey: ["payments", "for"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      if (payment.projectId) qc.invalidateQueries({ queryKey: ["project-profitability", String(payment.projectId)] });
      invalidateCustomerHub(qc, payment.customerId);
    },
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<AthenaRecord>(`/invoices/${id}/send`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patch<AthenaRecord>(`/invoices/${id}`, { status: "void" }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["reports", "period"] });
    },
  });
}

export function useSnags(enabled = true) {
  return useQuery({
    queryKey: ["snags"],
    queryFn: () => list<AthenaRecord>("/snags"),
    enabled,
  });
}

export function useCreateSnag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/snags", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snags"] }),
  });
}

export function useResolveSnag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<AthenaRecord>(`/snags/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snags"] }),
  });
}

export function useChangeOrders() {
  return useQuery({
    queryKey: ["change-orders"],
    queryFn: () => list<AthenaRecord>("/change-orders"),
  });
}

export function useCreateChangeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/change-orders", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-orders"] }),
  });
}

/** Approving adds the selling price to the contract value (and its cost to the estimated cost). */
export function useChangeOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "send" | "approve" | "reject" | "delete" }) => {
      if (action === "delete") {
        const { data } = await apiClient.delete<AthenaRecord>(`/change-orders/${id}`);
        return data;
      }
      return post<AthenaRecord>(`/change-orders/${id}/${action}`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-orders"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project-profitability"] });
    },
  });
}

export function useSurveys(siteId?: string) {
  return useQuery({
    queryKey: ["surveys", siteId || "all"],
    queryFn: () => list<AthenaRecord>("/surveys", siteId ? { site_id: siteId } : undefined),
  });
}

export function useSurvey(id?: string) {
  return useQuery({ ...detailQuery("surveys", id), enabled: Boolean(id) });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/surveys", body),
    onSuccess: (data, body) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      invalidateCustomerHub(qc, data.customerId ?? body.customerId);
    },
  });
}

export function useUpdateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/surveys/${id}`, body),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      qc.invalidateQueries({ queryKey: ["surveys", vars.id] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useEstimate(id?: string) {
  return useQuery({ ...detailQuery("estimates", id), enabled: Boolean(id) });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/estimates", body),
    onSuccess: (data, body) => {
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      invalidateCustomerHub(qc, data.customerId ?? body.customerId);
    },
  });
}

export function useReviseEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      post<AthenaRecord>(`/estimates/${id}/versions`, body),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["estimates", vars.id] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useEnsureEstimatePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<AthenaRecord>(`/estimates/${id}/pdf`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["estimates", id] });
    },
  });
}

export function useEnsureInvoicePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<AthenaRecord>(`/invoices/${id}/pdf`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}

export function useEnsureQuotePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<AthenaRecord>(`/quotes/${id}/pdf`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", id] });
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: Record<string, unknown>; key: string }) =>
      post<AthenaRecord>("/invoices", body, { "Idempotency-Key": key }),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project-profitability"] });
      qc.invalidateQueries({ queryKey: ["billing-review"] });
      invalidateCustomerHub(qc, data.customerId ?? vars.body.customerId);
    },
  });
}

export function useMeasurements(siteId?: string) {
  return useQuery({
    queryKey: ["measurements", siteId || "none"],
    queryFn: () => list<AthenaRecord>("/measurements", siteId ? { site_id: siteId } : undefined),
    enabled: Boolean(siteId),
  });
}

export function useMeasurement(id?: string) {
  return useQuery({ ...detailQuery("measurements", id), enabled: Boolean(id) });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/measurements", body),
    onSuccess: (data, body) => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      invalidateCustomerHub(qc, data.customerId ?? body.customerId);
    },
  });
}

export function useUpdateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/measurements/${id}`, body),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["measurements", "detail", vars.id] });
      invalidateCustomerHub(qc, data.customerId);
    },
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: () => list<AthenaRecord>("/documents"),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/documents", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => list<AthenaRecord>("/users"),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/users/invite", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export type OrgBranding = {
  company_name: string;
  company_address: string;
  gst_number: string;
  pan: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_branch: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_ifsc_code: string;
  upi_id: string;
  terms_conditions: string;
  logo_url: string;
  seal_url: string;
  signature_url: string;
  brand_color?: string;
  website?: string;
  estimate_terms?: string;
  state?: string;
  default_gst_rate?: string;
  estimate_validity_days?: string;
  invoice_due_days?: string;
  signatory_name?: string;
  signatory_designation?: string;
};

export function useOrgBranding(enabled = true) {
  return useQuery({
    enabled: useAuthedQueryEnabled(enabled),
    queryKey: ["organization", "branding"],
    queryFn: () => get<OrgBranding>("/organizations/current/document-branding"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateOrgBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) => patch<OrgBranding>("/organizations/current/document-branding", body),
    onSuccess: (data) => {
      qc.setQueryData(["organization", "branding"], data);
      // Estimate previews are rendered with the organization details, so drop the cached pages.
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "estimates" && q.queryKey[2] === "preview" });
      const { user, setUser } = useAuthStore.getState();
      if (user && data.company_name) setUser({ ...user, businessName: data.company_name });
    },
  });
}

export function useStockSummary() {
  return useQuery({
    queryKey: ["stock-summary"],
    queryFn: () => get<{ items: AthenaRecord[] }>("/stock/summary"),
  });
}

export function useDeliveryChallans() {
  return useQuery({
    queryKey: ["delivery-challans"],
    queryFn: () => list<AthenaRecord>("/delivery-challans"),
  });
}

export function useDeliveryChallan(id?: string) {
  return useQuery({ ...detailQuery("delivery-challans", id), enabled: Boolean(id) });
}

export function useCreateDeliveryChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/delivery-challans", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-challans"] }),
  });
}

export function useDeliveryChallanPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<AthenaRecord>(`/delivery-challans/${id}/pdf`),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["delivery-challans"] });
      if (doc?.id) qc.invalidateQueries({ queryKey: ["delivery-challans", String(doc.id)] });
    },
  });
}

export function useMeasurementReport(enabled = true) {
  return useQuery({
    queryKey: ["reports", "measurements"],
    queryFn: () => get<Record<string, unknown>>("/reports/measurements"),
    enabled,
  });
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => get<{ items: AthenaRecord[] }>("/reports/inventory"),
  });
}

export function useDailyExpensesReport() {
  return useQuery({
    queryKey: ["reports", "daily-expenses"],
    queryFn: () => get<Record<string, unknown>>("/reports/daily-expenses"),
  });
}

export function useGstr1Report() {
  return useQuery({
    queryKey: ["reports", "gstr1"],
    queryFn: () => get<{ items: AthenaRecord[]; count?: number }>("/reports/gstr1"),
  });
}

export function useGstr2bReport() {
  return useQuery({
    queryKey: ["reports", "gstr2b"],
    queryFn: () => get<{ items: AthenaRecord[]; count?: number }>("/reports/gstr2b"),
  });
}

export function useGstSummary() {
  return useQuery({
    queryKey: ["reports", "gst"],
    queryFn: () => get<Record<string, unknown>>("/reports/gst"),
  });
}
