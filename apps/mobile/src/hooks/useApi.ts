import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

type ListParams = Record<string, string | number | undefined>;

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

function invalidateCustomerHub(qc: ReturnType<typeof useQueryClient>, customerId?: unknown) {
  qc.invalidateQueries({ queryKey: ["customers"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  if (customerId) {
    const id = String(customerId);
    qc.invalidateQueries({ queryKey: ["customers", id] });
    qc.invalidateQueries({ queryKey: ["customers", id, "summary"] });
  }
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => get<Record<string, unknown>>("/me"),
    enabled,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<Record<string, unknown>>("/reports/dashboard"),
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => list<AthenaRecord>("/customers"),
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

export function useCustomerSummary(id?: string) {
  return useQuery({
    queryKey: ["customers", id, "summary"],
    queryFn: () => get<Record<string, unknown>>(`/customers/${id}/summary`),
    enabled: Boolean(id),
  });
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

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => list<AthenaRecord>("/sites"),
  });
}

export function useSite(id?: string) {
  return useQuery({
    queryKey: ["sites", id],
    queryFn: () => get<AthenaRecord>(`/sites/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/sites/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["sites", vars.id] });
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

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => list<AthenaRecord>("/projects"),
  });
}

export function useProject(id?: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => get<AthenaRecord>(`/projects/${id}`),
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
  return useQuery({
    queryKey: ["quotes", id],
    queryFn: () => get<AthenaRecord>(`/quotes/${id}`),
    enabled: Boolean(id),
  });
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
    mutationFn: ({ id, action }: { id: string; action: "send" | "accept" | "reject" }) =>
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

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => get<AthenaRecord>(`/invoices/${id}`),
    enabled: Boolean(id),
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
  return useQuery({
    queryKey: ["expenses", "detail", id],
    queryFn: () => get<AthenaRecord>(`/expenses/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/expenses/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses", "detail", vars.id] });
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
    }) => post<AthenaRecord>("/expenses", body),
    onSuccess: (_d, body) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["projects", body.projectId] });
      qc.invalidateQueries({ queryKey: ["project-profitability", body.projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAttendance() {
  return useQuery({
    queryKey: ["attendance"],
    queryFn: () => list<AthenaRecord>("/attendance"),
  });
}

export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { projectId: string; status: string; overtimeHours?: string }) =>
      post<AthenaRecord>("/attendance", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: () => list<AthenaRecord>("/materials"),
  });
}

export function useMaterial(id?: string) {
  return useQuery({
    queryKey: ["materials", id],
    queryFn: () => get<AthenaRecord>(`/materials/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch<AthenaRecord>(`/materials/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["materials", vars.id] });
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
  return useQuery({
    queryKey: ["labour", id],
    queryFn: () => get<AthenaRecord>(`/labour/${id}`),
    enabled: Boolean(id),
  });
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
    },
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

export function useSchedules() {
  return useQuery({
    queryKey: ["project-schedules"],
    queryFn: () => list<AthenaRecord>("/project-schedules"),
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

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<AthenaRecord>("/inventory", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: () => list<AthenaRecord>("/payments"),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { invoiceId: string; amount: string; method: string; reference?: string; notes?: string }) =>
      post<AthenaRecord>("/payments", body, { "Idempotency-Key": `pay-mobile-${Date.now()}` }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      invalidateCustomerHub(qc, data.customerId);
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

export function useSurveys(siteId?: string) {
  return useQuery({
    queryKey: ["surveys", siteId || "all"],
    queryFn: () => list<AthenaRecord>("/surveys", siteId ? { site_id: siteId } : undefined),
  });
}

export function useSurvey(id?: string) {
  return useQuery({
    queryKey: ["surveys", id],
    queryFn: () => get<AthenaRecord>(`/surveys/${id}`),
    enabled: Boolean(id),
  });
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
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      qc.invalidateQueries({ queryKey: ["surveys", vars.id] });
    },
  });
}

export function useEstimate(id?: string) {
  return useQuery({
    queryKey: ["estimates", id],
    queryFn: () => get<AthenaRecord>(`/estimates/${id}`),
    enabled: Boolean(id),
  });
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
      invalidateCustomerHub(qc, data.customerId ?? vars.body.customerId);
    },
  });
}

export function useMeasurements(siteId?: string) {
  return useQuery({
    queryKey: ["measurements", siteId || "all"],
    queryFn: () => list<AthenaRecord>("/measurements", siteId ? { site_id: siteId } : undefined),
  });
}

export function useMeasurement(id?: string) {
  return useQuery({
    queryKey: ["measurements", "detail", id],
    queryFn: () => get<AthenaRecord>(`/measurements/${id}`),
    enabled: Boolean(id),
  });
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
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["measurements", "detail", vars.id] });
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

