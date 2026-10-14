import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ArrowRight, Check, CheckCircle2, ChevronRight, FileText, FolderKanban, MapPin, MessageCircle, Navigation, Phone, Plus, Trash2, Users, XCircle } from "lucide-react-native";
import {
  useChangeOrderAction,
  useChangeOrders,
  useCrews,
  useCustomer,
  useExpenses,
  usePaymentsFor,
  useProjectInvoices,
  useProject,
  useProjectAttendance,
  useProjectProfitability,
  useProjectSchedules,
  useSite,
  useDeleteProject,
  useUpdateProject,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DirectionsButton } from "@/components/ui/DirectionsButton";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { FormField } from "@/components/ui/FormField";
import { DateField } from "@/components/ui/DateField";
import { useEstimateDrawer } from "@/components/estimates/EstimateDrawer";
import { useInvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { formatCurrency, formatDate } from "@/lib/format";
import { goBackOr, parseProjectTab, type ProjectTab } from "@/lib/nav";
import { rangeLabel } from "@/lib/attendance";
import { methodMeta } from "@/lib/payments";
import {
  PROJECT_STATUSES,
  budgetLinesOf,
  expenseCategoryLabel,
  isManualLabour,
  nextProjectStep,
  projectStatusMeta,
  projectSteps,
  type BudgetLine,
  type ProjectStep,
} from "@/lib/projects";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { cardShadow, lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Row = Record<string, unknown>;

const KIND_TITLE: Record<string, string> = { work: "Work", material: "Materials", tool: "Tool & equipment" };

export default function ProjectHub() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tabFromUrl = parseProjectTab(tabParam) || "details";
  const [tab, setTab] = useState<ProjectTab>(tabFromUrl);
  const projectQ = useProject(id);
  const project = projectQ.data;
  const profitQ = useProjectProfitability(id);
  const expensesQ = useExpenses(id);
  const invoicesQ = useProjectInvoices(id);
  const paymentsQ = usePaymentsFor({ projectId: id });
  const schedulesQ = useProjectSchedules(id);
  const attendanceQ = useProjectAttendance(id);
  const crewsQ = useCrews();
  const changeOrdersQ = useChangeOrders();
  const coAction = useChangeOrderAction();
  const update = useUpdateProject();
  const removeProject = useDeleteProject();
  const customerId = project?.customerId ? String(project.customerId) : "";
  const { data: customer } = useCustomer(customerId || undefined);
  const { data: site } = useSite(project?.siteId ? String(project.siteId) : undefined);
  const phone = String(customer?.phone || "").trim();
  const drawer = useEstimateDrawer({ phone, email: customer?.email ? String(customer.email) : null });
  const invoiceDrawer = useInvoiceDrawer({ onProject: () => setTab("money") });

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const invoices = useMemo(() => (invoicesQ.data?.items || []).filter((i) => String(i.projectId) === String(id)), [invoicesQ.data, id]);
  const invoiceIds = useMemo(() => new Set(invoices.map((i) => String(i.id))), [invoices]);
  const payments = useMemo(() => (paymentsQ.data?.items || []).filter((pay) => invoiceIds.has(String(pay.invoiceId))), [paymentsQ.data, invoiceIds]);
  const expenses = expensesQ.data?.items || [];
  const schedules = schedulesQ.data?.items || [];
  const attendance = attendanceQ.data?.items || [];
  const changeOrders = useMemo(() => (changeOrdersQ.data?.items || []).filter((c) => String(c.projectId) === String(id)), [changeOrdersQ.data, id]);

  const live = invoices.filter((i) => i.status !== "void");
  const contract = Number(project?.contractValue || 0);
  const billed = live.reduce((s, i) => s + Number(i.total || 0), 0);
  const collected = live.reduce((s, i) => s + Number(i.paid || 0), 0);
  const due = live.reduce((s, i) => s + Math.max(0, Number(i.outstanding || 0)), 0);
  const progress = Math.max(0, Math.min(100, Number(project?.completionPercent || 0)));
  const labourEntries = expenses.filter((e) => isManualLabour(e.category));
  const manualLabourTotal = labourEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const steps = project
    ? projectSteps({ project, schedules: schedules.length, attendance: attendance.length, expenses: expenses.length, invoices, manualLabour: labourEntries.length > 0 })
    : [];
  const next = nextProjectStep(steps);

  function back() {
    goBackOr(router, "/(tabs)/projects");
  }

  function goTab(nextTab: ProjectTab) {
    setTab(nextTab);
    router.setParams({ tab: nextTab });
  }

  function refreshAll() {
    projectQ.refetch();
    profitQ.refetch();
    expensesQ.refetch();
    invoicesQ.refetch();
    paymentsQ.refetch();
    schedulesQ.refetch();
    attendanceQ.refetch();
    changeOrdersQ.refetch();
  }

  function confirmComplete() {
    Alert.alert(
      "Mark project completed?",
      due > 0 ? `${formatCurrency(due)} is still due from the customer. You can keep collecting payments after closing.` : "The project moves to Completed and becomes read-only for new invoices.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark completed",
          onPress: async () => {
            try {
              await update.mutateAsync({ id: String(id), body: { status: "completed", completionPercent: 100 } });
              Toast.show({ type: "success", text1: "Project completed" });
            } catch (e) {
              Toast.show({ type: "error", text1: "Couldn't update project", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
            }
          },
        },
      ],
    );
  }

  function runStep(step: ProjectStep) {
    switch (step.action) {
      case "schedule":
        router.push(`/(tabs)/more/schedule/new?projectId=${id}` as never);
        break;
      case "attendance":
        router.push(`/(tabs)/attendance/${id}` as never);
        break;
      case "expense":
        router.push(`/(tabs)/expenses/new?projectId=${id}` as never);
        break;
      case "invoice":
        router.push(`/(tabs)/invoices/new?projectId=${id}` as never);
        break;
      case "payment": {
        const open = live.find((i) => Number(i.outstanding || 0) > 0);
        router.push((open ? `/(tabs)/payments/new?invoiceId=${open.id}` : `/(tabs)/payments/new?customerId=${customerId}`) as never);
        break;
      }
      case "complete":
        confirmComplete();
        break;
    }
  }

  function confirmDeleteProject() {
    Alert.alert(
      `Delete project "${String(project?.name || project?.number || "")}"?`,
      "Its crew schedules and draft change orders are removed too. The approved estimate stays, and you can start a project from it again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete project",
          style: "destructive",
          onPress: async () => {
            try {
              await removeProject.mutateAsync(String(id));
              Toast.show({ type: "success", text1: "Project deleted" });
              router.replace("/(tabs)/projects" as never);
            } catch (e) {
              Toast.show({ type: "error", text1: "Couldn't delete project", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
            }
          },
        },
      ],
    );
  }

  function decideChangeOrder(co: Row, action: "approve" | "reject" | "delete") {
    const price = formatCurrency(String(co.sellingPrice || 0));
    const number = String(co.number || "");
    const copy = {
      approve: { title: `Approve change order ${number}?`, body: `${price} will be added to the contract value so it can be invoiced.`, button: "Approve", done: "Change order approved" },
      reject: { title: `Reject change order ${number}?`, body: "The contract value stays the same.", button: "Reject", done: "Change order rejected" },
      delete: { title: `Delete change order ${number}?`, body: "It will be removed from this project. The contract value doesn't change.", button: "Delete change order", done: "Change order deleted" },
    }[action];
    Alert.alert(
      copy.title,
      copy.body,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: copy.button,
          style: action === "approve" ? "default" : "destructive",
          onPress: async () => {
            try {
              await coAction.mutateAsync({ id: String(co.id), action });
              Toast.show({ type: "success", text1: copy.done, text2: action === "approve" ? `Contract value increased by ${price}.` : undefined });
            } catch (e) {
              Toast.show({ type: "error", text1: "Couldn't update change order", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
            }
          },
        },
      ],
    );
  }

  if (!project) {
    return (
      <SoftBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.pad}>
            <ScreenHeader title="Project" onBack={back} />
            {projectQ.isError ? (
              <ErrorBanner message={(projectQ.error as { userMessage?: string })?.userMessage || "Couldn't load this project."} onRetry={() => projectQ.refetch()} />
            ) : (
              <ActivityIndicator color={p.clay} style={{ marginTop: 40 }} />
            )}
          </View>
        </SafeAreaView>
      </SoftBackground>
    );
  }

  const status = projectStatusMeta(project.status);
  const siteAddress = String(site?.address || "").trim();
  const mapsUrl =
    site?.lat != null && site?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`
      : String(site?.mapsUrl || "") || (siteAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteAddress)}` : "");

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={projectQ.isRefetching && !projectQ.isPlaceholderData} onRefresh={refreshAll} tintColor={p.clay} />}
          stickyHeaderIndices={[3]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pad}>
            <ScreenHeader title="Project" subtitle={project.number ? String(project.number) : undefined} onBack={back} />
          </View>

          <View style={[styles.pad, { marginBottom: spacing.md }]}>
            <View style={styles.profile}>
              <View style={styles.profileTop}>
                <View style={styles.tile}>
                  <FolderKanban size={26} color={p.clayDark} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {String(project.name || project.number || "Project")}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[customer?.name, site?.name].filter(Boolean).map(String).join(" · ") || "—"}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.pillText, { color: status.fg }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.progressWrap}>
                <View style={styles.progressHead}>
                  <Text style={styles.progressLabel}>Work done</Text>
                  <Text style={styles.progressValue}>{progress}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.quick}>
                <Quick label="Call" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)} icon={<Phone size={18} color={p.clayDark} />} />
                <Quick
                  label="WhatsApp"
                  disabled={!phone}
                  onPress={() =>
                    shareViaWhatsApp({ phone, message: `Hello ${String(customer?.name || "")}, an update on ${String(project.name || "your project")}:` }).catch(() => undefined)
                  }
                  icon={<MessageCircle size={18} color="#15803D" />}
                />
                <Quick
                  label="Directions"
                  disabled={!mapsUrl}
                  onPress={() => Linking.openURL(mapsUrl).catch(() => Toast.show({ type: "error", text1: "Couldn't open maps" }))}
                  icon={<Navigation size={18} color={p.blue} />}
                />
              </View>

              <View style={styles.money}>
                <MoneyCell label="Contract" value={formatCurrency(contract)} />
                <View style={styles.moneySep} />
                <MoneyCell label="Billed" value={formatCurrency(billed)} />
                <View style={styles.moneySep} />
                <MoneyCell label="Due" value={formatCurrency(due)} tone={due > 0 ? "red" : undefined} />
              </View>
            </View>
          </View>

          {next ? (
            <View style={[styles.pad, { marginBottom: spacing.md }]}>
              <Pressable style={styles.next} onPress={() => runStep(next)} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextLabel}>Next step</Text>
                  <Text style={styles.nextTitle}>{next.title}</Text>
                  <Text style={styles.nextDetail}>{next.detail}</Text>
                </View>
                <View style={styles.nextGo}>
                  <ArrowRight size={18} color="#fff" strokeWidth={2.6} />
                </View>
              </Pressable>
            </View>
          ) : (
            <View />
          )}

          <View>
            <SegmentTabs
              floating
              value={tab}
              onChange={goTab}
              tabs={[
                { key: "details", label: "Overview" },
                { key: "budget", label: `Budget & spend${expenses.length ? ` ${expenses.length}` : ""}` },
                { key: "team", label: `Crew${schedules.length ? ` ${schedules.length}` : ""}` },
                { key: "money", label: `Billing${invoices.length ? ` ${invoices.length}` : ""}` },
              ]}
            />
          </View>

          <View style={styles.pad}>
            {tab === "details" ? (
              <OverviewTab
                project={project}
                customer={customer}
                site={site}
                steps={steps}
                onStep={runStep}
                onEstimate={() => project.estimateId && drawer.open(String(project.estimateId))}
                onCustomer={() => customerId && router.push(`/(tabs)/customers/${customerId}` as never)}
                saving={update.isPending}
                onSave={async (body) => {
                  try {
                    await update.mutateAsync({ id: String(id), body });
                    Toast.show({ type: "success", text1: "Project updated" });
                  } catch (e) {
                    Toast.show({ type: "error", text1: "Couldn't save project", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
                  }
                }}
                deleting={removeProject.isPending}
                onDelete={live.length === 0 && attendance.length === 0 && expenses.length === 0 ? confirmDeleteProject : undefined}
              />
            ) : null}

            {tab === "budget" ? (
              <BudgetTab
                profit={profitQ.data}
                profitLoading={profitQ.isLoading}
                profitBlocked={profitQ.isError}
                project={project}
                expenses={expenses}
                onAddExpense={() => router.push(`/(tabs)/expenses/new?projectId=${id}` as never)}
                onExpense={(eid) => router.push(`/(tabs)/expenses/${eid}?projectId=${id}` as never)}
              />
            ) : null}

            {tab === "team" ? (
              <>
                {schedulesQ.isLoading ? <ActivityIndicator color={p.clay} /> : null}
                {!schedulesQ.isLoading && schedules.length === 0 && labourEntries.length > 0 ? (
                  <View style={styles.modeCard}>
                    <Text style={styles.modeTitle}>Labour is entered manually</Text>
                    <Text style={styles.modeBody}>
                      {formatCurrency(manualLabourTotal)} logged in {labourEntries.length} labour entr{labourEntries.length === 1 ? "y" : "ies"} under Budget & spend. To
                      use a crew with attendance instead, delete those labour expenses first.
                    </Text>
                    <Pressable style={styles.secondary} onPress={() => router.push(`/(tabs)/expenses/new?projectId=${id}&category=labour` as never)} accessibilityRole="button">
                      <Text style={styles.secondaryText}>Add labour charge</Text>
                    </Pressable>
                  </View>
                ) : null}
                {!schedulesQ.isLoading && schedules.length === 0 && labourEntries.length === 0 ? (
                  <View style={styles.modeCard}>
                    <Text style={styles.modeTitle}>How do you want to track labour?</Text>
                    <Text style={styles.modeBody}>
                      Schedule a crew: attendance must be marked every day, and labour cost is calculated from it automatically.{"\n"}
                      No crew: enter labour charges yourself as expenses.
                    </Text>
                    <AddButton label="Schedule a crew" onPress={() => router.push(`/(tabs)/more/schedule/new?projectId=${id}` as never)} />
                    <Pressable style={styles.secondary} onPress={() => router.push(`/(tabs)/expenses/new?projectId=${id}&category=labour` as never)} accessibilityRole="button">
                      <Text style={styles.secondaryText}>Enter labour charges manually</Text>
                    </Pressable>
                  </View>
                ) : null}
                {schedules.length > 0 ? (
                  <AddButton label="Schedule another crew" onPress={() => router.push(`/(tabs)/more/schedule/new?projectId=${id}` as never)} />
                ) : null}
                {schedules.map((s) => {
                  const crew = (crewsQ.data?.items || []).find((c) => String(c.id) === String(s.crewId || ""));
                  const start = String(s.startDate || "").slice(0, 10);
                  const end = String(s.endDate || s.startDate || "").slice(0, 10);
                  const members = Array.isArray(crew?.members) ? (crew?.members as unknown[]).length : 0;
                  return (
                    <Pressable key={String(s.id)} style={styles.listRow} onPress={() => router.push(`/(tabs)/more/schedule/${String(s.id)}` as never)} accessibilityRole="button">
                      <View style={[styles.rowIcon, { backgroundColor: p.sky }]}>
                        <Users size={18} color={p.blue} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.listTitle} numberOfLines={1}>
                          {String(crew?.name || "Crew")}
                        </Text>
                        <Text style={styles.listSub} numberOfLines={1}>
                          {[start ? rangeLabel(start, end) : "Dates not set", members ? `${members} worker${members === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={p.faint} />
                    </Pressable>
                  );
                })}
                {schedules.length > 0 ? (
                  <Pressable style={styles.secondary} onPress={() => router.push(`/(tabs)/attendance/${id}` as never)} accessibilityRole="button">
                    <CheckCircle2 size={18} color={p.clayDark} />
                    <Text style={styles.secondaryText}>Mark attendance{attendance.length ? ` · ${attendance.length} marked` : ""}</Text>
                  </Pressable>
                ) : null}
                {schedules.length > 0 ? (
                  <Text style={styles.explain}>
                    Mark attendance every working day. Days worked × each worker's daily rate becomes this project's labour cost in Budget & spend. It isn't added to the
                    customer's invoice, because labour is already priced in the estimate's work rates.
                  </Text>
                ) : null}
              </>
            ) : null}

            {tab === "money" ? (
              <>
                <View style={styles.grid}>
                  <Stat label="Contract value" value={formatCurrency(contract)} hint={Number(project.approvedChangeOrders || 0) > 0 ? `Includes ${formatCurrency(String(project.approvedChangeOrders))} of change orders` : "From the approved estimate"} />
                  <Stat label="Left to bill" value={formatCurrency(Math.max(0, contract - billed))} hint="Contract − billed" />
                  <Stat label="Collected" value={formatCurrency(collected)} hint={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} tone="green" />
                  <Stat label="Due" value={formatCurrency(due)} hint="Billed − collected" tone={due > 0 ? "red" : undefined} />
                </View>
                <View style={styles.rowGap}>
                  <Pressable
                    style={[styles.addBtn, { flex: 1 }, project.status === "completed" && { opacity: 0.5 }]}
                    disabled={project.status === "completed"}
                    onPress={() => router.push(`/(tabs)/invoices/new?projectId=${id}` as never)}
                    accessibilityRole="button"
                  >
                    <Plus size={18} color="#fff" strokeWidth={2.6} />
                    <Text style={styles.addText}>Create invoice</Text>
                  </Pressable>
                  {due > 0 ? (
                    <Pressable style={[styles.secondary, { flex: 1, marginTop: 0, marginBottom: 12 }]} onPress={() => runStep({ key: "payment", title: "", detail: "", done: false, action: "payment" })}>
                      <Text style={styles.secondaryText}>Record payment</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.section}>Invoices</Text>
                {invoices.length === 0 ? <Text style={styles.muted}>No invoices yet. Raise an advance or progress bill as work moves.</Text> : null}
                {invoices.map((inv) => {
                  const voided = inv.status === "void";
                  const out = Number(inv.outstanding || 0);
                  return (
                    <ListRow
                      key={String(inv.id)}
                      icon={<FileText size={18} color={p.purple} />}
                      iconBg={p.lilac}
                      title={String(inv.number || "Invoice")}
                      subtitle={voided ? "Voided" : out > 0 ? `${formatCurrency(out)} due${inv.dueDate ? ` · by ${formatDate(String(inv.dueDate))}` : ""}` : "Paid"}
                      value={formatCurrency(String(inv.total || 0))}
                      muted={voided}
                      onPress={() => invoiceDrawer.open(String(inv.id))}
                    />
                  );
                })}

                <Text style={styles.section}>Payments</Text>
                {payments.length === 0 ? <Text style={styles.muted}>No payments yet.</Text> : null}
                {payments.map((pay) => (
                  <ListRow
                    key={String(pay.id)}
                    title={methodMeta(pay.method).label}
                    subtitle={formatDate(String(pay.createdAt || ""))}
                    value={formatCurrency(String(pay.amount || 0))}
                    onPress={() => router.push(`/(tabs)/payments/${pay.id}` as never)}
                  />
                ))}

                <View style={styles.sectionRow}>
                  <Text style={[styles.section, { marginBottom: 0 }]}>Change orders</Text>
                  {project.status !== "completed" ? (
                    <Pressable onPress={() => router.push(`/(tabs)/change-orders/new?projectId=${id}` as never)} hitSlop={8}>
                      <Text style={styles.link}>+ Add</Text>
                    </Pressable>
                  ) : null}
                </View>
                {changeOrders.length === 0 ? <Text style={styles.muted}>Extra work the customer asks for after approval goes here. Approving adds it to the contract value.</Text> : null}
                {changeOrders.map((co) => {
                  const pending = co.status !== "approved" && co.status !== "rejected";
                  return (
                    <View key={String(co.id)} style={styles.coCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.listTitle} numberOfLines={2}>
                            {String(co.reason || "Change order")}
                          </Text>
                          <Text style={styles.listSub}>
                            {[co.number, co.status === "approved" ? "Approved" : co.status === "rejected" ? "Rejected" : "Awaiting approval"].filter(Boolean).map(String).join(" · ")}
                          </Text>
                        </View>
                        <Text style={styles.listValue}>{formatCurrency(String(co.sellingPrice || 0))}</Text>
                      </View>
                      {pending ? (
                        <View style={[styles.rowGap, { marginTop: 10 }]}>
                          <Pressable style={[styles.coBtn, styles.coApprove]} onPress={() => decideChangeOrder(co, "approve")} disabled={coAction.isPending}>
                            <Check size={16} color="#fff" strokeWidth={2.6} />
                            <Text style={styles.coApproveText}>Approve</Text>
                          </Pressable>
                          <Pressable style={[styles.coBtn, styles.coReject]} onPress={() => decideChangeOrder(co, "reject")} disabled={coAction.isPending}>
                            <XCircle size={16} color={p.red} />
                            <Text style={styles.coRejectText}>Reject</Text>
                          </Pressable>
                        </View>
                      ) : null}
                      {co.status !== "approved" ? (
                        <Pressable onPress={() => decideChangeOrder(co, "delete")} disabled={coAction.isPending} hitSlop={8} style={{ marginTop: 10, alignSelf: "flex-start" }}>
                          <Text style={styles.coDeleteText}>Delete change order</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : null}
          </View>
        </ScrollView>
        {drawer.element}
        {invoiceDrawer.element}
      </SafeAreaView>
    </SoftBackground>
  );
}

function OverviewTab({
  project,
  customer,
  site,
  steps,
  onStep,
  onEstimate,
  onCustomer,
  saving,
  onSave,
  deleting,
  onDelete,
}: {
  project: Row;
  customer?: Row;
  site?: Row;
  steps: ProjectStep[];
  onStep: (s: ProjectStep) => void;
  onEstimate: () => void;
  onCustomer: () => void;
  saving: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  deleting?: boolean;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(String(project.name || ""));
  const [status, setStatus] = useState(String(project.status || "scheduled"));
  const [progress, setProgress] = useState(Number(project.completionPercent || 0));
  const [startDate, setStartDate] = useState(String(project.startDate || "").slice(0, 10));
  const [endDate, setEndDate] = useState(String(project.expectedCompletion || "").slice(0, 10));
  const [notes, setNotes] = useState(String(project.internalNotes || ""));
  const firstOpen = steps.findIndex((s) => !s.done);

  useEffect(() => {
    setName(String(project.name || ""));
    setStatus(String(project.status || "scheduled"));
    setProgress(Number(project.completionPercent || 0));
    setStartDate(String(project.startDate || "").slice(0, 10));
    setEndDate(String(project.expectedCompletion || "").slice(0, 10));
    setNotes(String(project.internalNotes || ""));
    // Re-sync only when the saved project changes, not on every background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.updatedAt]);

  return (
    <>
      <Card title="How this project runs">
        <Text style={styles.cardHint}>It continues from the approved estimate. Tap a step to do it.</Text>
        {steps.map((s, i) => {
          const current = i === firstOpen;
          return (
            <Pressable
              key={s.key}
              style={[styles.step, i === steps.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => s.action && onStep(s)}
              disabled={!s.action}
              accessibilityRole="button"
            >
              <View style={[styles.stepDot, s.done && styles.stepDone, current && styles.stepCurrent]}>
                {s.done ? <Check size={13} color="#fff" strokeWidth={3} /> : <Text style={[styles.stepNum, current && { color: "#fff" }]}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, s.done && { color: p.muted }]}>{s.title}</Text>
                <Text style={styles.stepDetail}>{s.detail}</Text>
              </View>
              {s.action && !s.done ? <ChevronRight size={18} color={p.faint} /> : null}
            </Pressable>
          );
        })}
      </Card>

      <Card title="Linked records">
        <LinkRow icon={<FileText size={18} color={p.purple} />} bg={p.lilac} label="Approved estimate" value="Open estimate & PDF" onPress={onEstimate} disabled={!project.estimateId} />
        <LinkRow icon={<Users size={18} color={p.clayDark} />} bg={p.claySoft} label="Customer" value={String(customer?.name || "—")} onPress={onCustomer} disabled={!customer} />
        <LinkRow icon={<MapPin size={18} color={p.green} />} bg={p.mint} label="Site"
          value={[site?.name, site?.address].filter(Boolean).map(String).join(" · ") || "—"}
          trailing={site ? <DirectionsButton place={site} label={String(site.name || "site")} /> : null}
          last
        />
      </Card>

      <Card title="Project settings">
        <FormField label="Project name" value={name} onChangeText={setName} placeholder="Project name" />
        <FormField label="Status">
          <View style={styles.chips}>
            {PROJECT_STATUSES.map((s) => {
              const on = status === s;
              return (
                <Pressable key={s} style={[styles.chip, on && styles.chipOn]} onPress={() => setStatus(s)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{projectStatusMeta(s).label}</Text>
                </Pressable>
              );
            })}
          </View>
        </FormField>
        <FormField label={`Work done · ${progress}%`}>
          <View style={styles.chips}>
            {[0, 10, 25, 50, 75, 90, 100].map((v) => (
              <Pressable key={v} style={[styles.chip, progress === v && styles.chipOn]} onPress={() => setProgress(v)}>
                <Text style={[styles.chipText, progress === v && styles.chipTextOn]}>{v}%</Text>
              </Pressable>
            ))}
          </View>
        </FormField>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label="Start date">
              <DateField value={startDate} onChange={setStartDate} />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Expected finish">
              <DateField value={endDate} onChange={setEndDate} />
            </FormField>
          </View>
        </View>
        <FormField label="Internal notes" value={notes} onChangeText={setNotes} multiline placeholder="Only your team sees this" />
        <Pressable
          style={[styles.addBtn, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={() =>
            onSave({
              name: name.trim() || project.name,
              status,
              completionPercent: progress,
              startDate: startDate || null,
              expectedCompletion: endDate || null,
              internalNotes: notes.trim() || null,
            })
          }
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.addText}>Save changes</Text>}
        </Pressable>
      </Card>

      {onDelete ? (
        <>
          <Pressable style={[styles.danger, deleting && { opacity: 0.6 }]} onPress={onDelete} disabled={deleting} accessibilityRole="button">
            {deleting ? <ActivityIndicator color={p.red} /> : <Trash2 size={18} color={p.red} strokeWidth={2.4} />}
            <Text style={styles.dangerText}>Delete project</Text>
          </Pressable>
          <Text style={styles.dangerHint}>Only possible before any invoice, payment, attendance or expense is added.</Text>
        </>
      ) : null}
    </>
  );
}

function BudgetTab({
  profit,
  profitLoading,
  profitBlocked,
  project,
  expenses,
  onAddExpense,
  onExpense,
}: {
  profit?: Row;
  profitLoading: boolean;
  profitBlocked: boolean;
  project: Row;
  expenses: Row[];
  onAddExpense: () => void;
  onExpense: (id: string) => void;
}) {
  const heads = (profit?.heads as Row[] | undefined) || [];
  const lines = budgetLinesOf(profit).length ? budgetLinesOf(profit) : budgetLinesOf(project);
  const lineName = (lid: unknown) => lines.find((l) => l.id === lid)?.description;
  const actual = Number(profit?.actualCost || 0);
  const contract = Number(profit?.contractValue || project.contractValue || 0);
  const profitSoFar = Number(profit?.actualProfit || 0);

  return (
    <>
      <AddButton label="Log expense" onPress={onAddExpense} />
      <Text style={styles.explain}>
        The estimate is the budget. Quoted is what the customer pays for each part; spent is what you've paid out: expenses, purchases and labour (from attendance, or
        entered manually when no crew is scheduled).
      </Text>

      {profitLoading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 8 }} /> : null}
      {profit ? (
        <>
          <View style={styles.grid}>
            <Stat label="Spent so far" value={formatCurrency(actual)} hint={`${contract ? Math.round((actual / contract) * 100) : 0}% of contract value`} />
            <Stat label="Profit so far" value={formatCurrency(profitSoFar)} hint="Collected − spent" tone={profitSoFar < 0 ? "red" : "green"} />
          </View>
          {profit.risk === "margin_risk" ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>Spending is running ahead of work done. Check the heads below before buying more.</Text>
            </View>
          ) : null}
          <Card title="Quoted vs spent">
            {heads.map((h, i) => (
              <HeadRow key={String(h.key)} head={h} last={i === heads.length - 1} wages={h.key === "labour" ? Number(profit.attendanceWages || 0) : 0} />
            ))}
          </Card>
        </>
      ) : profitBlocked ? (
        <Text style={styles.muted}>You don't have access to costs and profit for this project.</Text>
      ) : null}

      {lines.length ? (
        <Card title="Estimate lines">
          {["work", "material", "tool"].map((kind) => {
            const rows = lines.filter((l) => l.kind === kind);
            if (!rows.length) return null;
            return (
              <View key={kind} style={{ marginBottom: 6 }}>
                <Text style={styles.kindTitle}>{KIND_TITLE[kind]}</Text>
                {rows.map((l) => (
                  <LineRow key={l.id} line={l} />
                ))}
              </View>
            );
          })}
        </Card>
      ) : null}

      <Text style={styles.section}>Expenses</Text>
      {expenses.length === 0 ? <Text style={styles.muted}>Nothing logged yet. Log snacks, transport, small material purchases and tool hire as they happen.</Text> : null}
      {expenses.map((e) => (
        <ListRow
          key={String(e.id)}
          title={expenseCategoryLabel(e.category)}
          subtitle={[lineName(e.budgetLineId) ? `For: ${lineName(e.budgetLineId)}` : "", String(e.description || ""), formatDate(String(e.createdAt || ""))].filter(Boolean).join(" · ")}
          value={formatCurrency(String(e.amount || 0))}
          onPress={() => onExpense(String(e.id))}
        />
      ))}
    </>
  );
}

function HeadRow({ head, last, wages }: { head: Row; last?: boolean; wages: number }) {
  const quoted = Number(head.quoted || 0);
  const spent = Number(head.spent || 0);
  const pct = quoted > 0 ? Math.min(100, (spent / quoted) * 100) : spent > 0 ? 100 : 0;
  const over = quoted > 0 ? spent > quoted : false;
  return (
    <View style={[styles.head, last && { borderBottomWidth: 0 }]}>
      <View style={styles.headTop}>
        <Text style={styles.headLabel}>{String(head.label)}</Text>
        <Text style={[styles.headValue, over && { color: p.red }]}>
          {formatCurrency(spent)}
          <Text style={styles.headOf}>{quoted > 0 ? ` of ${formatCurrency(quoted)}` : ""}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }, over && { backgroundColor: p.red }]} />
      </View>
      {wages > 0 ? <Text style={styles.headHint}>Includes {formatCurrency(wages)} attendance wages</Text> : null}
      {quoted === 0 && spent > 0 ? <Text style={styles.headHint}>Not in the estimate — comes out of your margin</Text> : null}
    </View>
  );
}

function LineRow({ line }: { line: BudgetLine }) {
  const spent = Number(line.spent || 0);
  return (
    <View style={styles.lineRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.lineTitle} numberOfLines={2}>
          {line.description}
        </Text>
        <Text style={styles.lineSub}>{[line.quantity && line.unit ? `${line.quantity} ${line.unit}` : "", spent > 0 ? `spent ${formatCurrency(spent)}` : ""].filter(Boolean).join(" · ")}</Text>
      </View>
      <Text style={styles.lineAmount}>{formatCurrency(line.amount)}</Text>
    </View>
  );
}

function Quick({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.quickBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      {icon}
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function MoneyCell({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <View style={styles.moneyCell}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, tone === "red" && { color: p.red }, tone === "green" && { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function LinkRow({
  icon,
  bg,
  label,
  value,
  onPress,
  disabled,
  last,
  trailing,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
  last?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable style={[styles.link2, last && { borderBottomWidth: 0 }]} onPress={onPress} disabled={disabled || !onPress} accessibilityRole={onPress ? "button" : undefined}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {trailing}
      {onPress && !disabled ? <ChevronRight size={18} color={p.faint} /> : null}
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.addBtn} onPress={onPress} accessibilityRole="button">
      <Plus size={18} color="#fff" strokeWidth={2.6} />
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "red" | "green" }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === "red" && { color: p.red }, tone === "green" && { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statHint} numberOfLines={2}>
        {hint}
      </Text>
    </View>
  );
}

function ListRow({
  title,
  subtitle,
  value,
  onPress,
  muted,
  icon,
  iconBg,
}: {
  title: string;
  subtitle: string;
  value: string;
  onPress: () => void;
  muted?: boolean;
  icon?: React.ReactNode;
  iconBg?: string;
}) {
  return (
    <Pressable style={[styles.listRow, muted && { opacity: 0.55 }]} onPress={onPress} accessibilityRole="button">
      {icon ? <View style={[styles.rowIcon, { backgroundColor: iconBg || p.slateSoft }]}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.listSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={styles.listValue}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
  content: { paddingTop: spacing.sm, paddingBottom: tabBarClearance },
  profile: { backgroundColor: p.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: p.border, padding: spacing.md, ...cardShadow },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  tile: { width: 56, height: 56, borderRadius: 18, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  name: { color: p.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  meta: { color: p.muted, fontSize: 13, marginTop: 3, fontWeight: "600" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "800" },
  progressWrap: { marginTop: 14 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { color: p.muted, fontSize: 12, fontWeight: "700" },
  progressValue: { color: p.text, fontSize: 12, fontWeight: "800" },
  track: { height: 8, borderRadius: 4, backgroundColor: p.slateSoft, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: p.clay },
  quick: { flexDirection: "row", gap: 8, marginTop: 14 },
  quickBtn: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: radius.md, backgroundColor: p.background, borderWidth: 1, borderColor: p.border },
  quickText: { color: p.text, fontSize: 12, fontWeight: "700" },
  money: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: p.border },
  moneyCell: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  moneySep: { width: 1, backgroundColor: p.border },
  moneyLabel: { color: p.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  moneyValue: { color: p.text, fontWeight: "800", marginTop: 4, fontSize: 16 },
  next: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: p.claySoft, borderRadius: radius.lg, borderWidth: 1, borderColor: p.clayMid, padding: spacing.md },
  nextLabel: { color: p.clayDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  nextTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginTop: 3 },
  nextDetail: { color: p.muted, fontSize: 13, marginTop: 2 },
  nextGo: { width: 38, height: 38, borderRadius: 19, backgroundColor: p.clay, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 4, marginBottom: spacing.md },
  cardTitle: { color: p.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  cardHint: { color: p.muted, fontSize: 13, marginBottom: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: p.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: p.surface },
  stepDone: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  stepCurrent: { backgroundColor: p.clay, borderColor: p.clay },
  stepNum: { color: p.muted, fontSize: 12, fontWeight: "800" },
  stepTitle: { color: p.text, fontSize: 14, fontWeight: "700" },
  stepDetail: { color: p.muted, fontSize: 12, marginTop: 2 },
  link2: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  fieldLabel: { color: p.muted, fontSize: 12, fontWeight: "700" },
  fieldValue: { color: p.text, fontSize: 15, marginTop: 2 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: p.borderStrong, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.text, borderColor: p.text },
  chipText: { color: p.muted, fontWeight: "700", fontSize: 12 },
  chipTextOn: { color: "#fff" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: p.clay, borderRadius: radius.md, paddingVertical: 13, marginBottom: 12 },
  addText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  secondaryText: { color: p.clayDark, fontWeight: "800", fontSize: 15 },
  explain: { color: p.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  modeCard: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: spacing.md, marginBottom: 12, ...cardShadow },
  modeTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  modeBody: { color: p.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 12 },
  statLabel: { color: p.muted, fontSize: 12, fontWeight: "700" },
  statValue: { color: p.text, fontSize: 18, fontWeight: "800", marginTop: 4 },
  statHint: { color: p.faint, fontSize: 11, marginTop: 3 },
  warn: { backgroundColor: p.amberSoft, borderColor: "#FDE68A", borderWidth: 1, borderRadius: radius.sm, padding: 12, marginBottom: 12 },
  warnText: { color: "#92400E", fontSize: 13, fontWeight: "600" },
  head: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  headTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 },
  headLabel: { color: p.text, fontWeight: "700", fontSize: 14, flexShrink: 1 },
  headValue: { color: p.text, fontWeight: "800", fontSize: 14 },
  headOf: { color: p.muted, fontWeight: "600", fontSize: 12 },
  headHint: { color: p.muted, fontSize: 11, marginTop: 4 },
  kindTitle: { color: p.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 6, marginBottom: 2 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.border },
  lineTitle: { color: p.text, fontSize: 14, fontWeight: "600" },
  lineSub: { color: p.muted, fontSize: 12, marginTop: 2 },
  lineAmount: { color: p.text, fontWeight: "800", fontSize: 13 },
  section: { color: p.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginTop: spacing.md, marginBottom: 8 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, marginBottom: 8 },
  link: { color: p.clayDark, fontWeight: "800" },
  muted: { color: p.muted, fontSize: 13, marginBottom: 8, lineHeight: 19 },
  rowGap: { flexDirection: "row", gap: 10 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 8 },
  listTitle: { color: p.text, fontWeight: "700" },
  listSub: { color: p.muted, fontSize: 12, marginTop: 2 },
  listValue: { color: p.text, fontWeight: "800" },
  coCard: { backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 8 },
  coBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md },
  coApprove: { backgroundColor: "#16A34A" },
  coApproveText: { color: "#fff", fontWeight: "800" },
  coReject: { backgroundColor: p.redSoft, borderWidth: 1, borderColor: "#FECACA" },
  coRejectText: { color: p.red, fontWeight: "800" },
  coDeleteText: { color: p.muted, fontWeight: "700", fontSize: 12, textDecorationLine: "underline" },
  danger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: p.redSoft,
    marginTop: 4,
  },
  dangerText: { color: p.red, fontWeight: "700", fontSize: 15 },
  dangerHint: { color: p.muted, fontSize: 12, textAlign: "center", marginTop: 8, marginBottom: 12 },
});
