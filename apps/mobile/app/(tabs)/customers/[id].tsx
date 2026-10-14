import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ArrowRight, Building2, Mail, MessageCircle, Pencil, Phone, Plus, Trash2 } from "lucide-react-native";
import { useCachedCustomer, useCustomerSummary, useDeleteCustomer } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { Avatar } from "@/components/ui/Avatar";
import { DirectionsButton } from "@/components/ui/DirectionsButton";
import { ActivityLog, type ActivityEvent } from "@/components/customers/ActivityLog";
import { FollowUpsCard } from "@/components/customers/FollowUpsCard";
import { EstimateRow, MeasurementRow, SiteRow, SurveyRow } from "@/components/customers/WorkflowRows";
import { useEstimateDrawer } from "@/components/estimates/EstimateDrawer";
import { useInvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { confirmDestructive, describeCounts, showDeleteError } from "@/lib/confirm";
import { customerDisplayName, customerTypeLabel, sourceLabel } from "@/lib/customers";
import { formatCurrency, formatDate } from "@/lib/format";
import { goBackOr, parseCustomerTab, sitePath, type CustomerTab } from "@/lib/nav";
import { methodMeta } from "@/lib/payments";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { cardShadow, lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Row = Record<string, unknown>;
type WorkKind = "surveys" | "measurements" | "estimates";

const NEW_LABEL: Record<WorkKind, string> = { surveys: "survey", measurements: "measurement", estimates: "estimate" };

export default function CustomerDetail() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tabFromUrl = parseCustomerTab(tabParam) || "details";
  const [tab, setTab] = useState<CustomerTab>(tabFromUrl);
  const summaryQ = useCustomerSummary(id);
  const cached = useCachedCustomer(id);
  const del = useDeleteCustomer();
  const data = summaryQ.data;
  const customer = (data?.customer || cached || {}) as Row;
  const drawer = useEstimateDrawer({ phone: customer.phone as string, email: customer.email as string });
  const invoiceDrawer = useInvoiceDrawer();

  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  function goTab(next: CustomerTab) {
    if (next === tab) return;
    setTab(next);
    router.setParams({ tab: next });
  }

  const sites = (data?.sites as Row[]) || [];
  const surveys = (data?.surveys as Row[]) || [];
  const measurements = (data?.measurements as Row[]) || [];
  const estimates = (data?.estimates as Row[]) || [];
  const projects = (data?.projects as Row[]) || [];
  const invoices = (data?.invoices as Row[]) || [];
  const payments = (data?.payments as Row[]) || [];
  const followUps = (data?.followUps as Row[]) || [];
  const activity = (data?.activity as ActivityEvent[]) || [];
  const money = (data?.money || {}) as Record<string, string>;
  const counts = (data?.counts || {}) as Record<string, number>;
  const siteName = useMemo(() => {
    const map = new Map(sites.map((s) => [String(s.id), String(s.name || "Site")]));
    return (siteId: unknown) => map.get(String(siteId || "")) || "";
  }, [sites]);

  const title = customerDisplayName(customer);
  const phone = String(customer.phone || "").trim();
  const email = String(customer.email || "").trim();
  const back = () => goBackOr(router, "/(tabs)/customers");

  /** Survey, measurement and estimate always belong to a site. */
  function startNew(kind: WorkKind, siteId?: string) {
    if (!sites.length) {
      Alert.alert("Add a site first", `A ${NEW_LABEL[kind]} is always for a specific site. Add the customer's site, then continue.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Add site", onPress: () => router.push(`/(tabs)/sites/new?customerId=${id}` as never) },
      ]);
      return;
    }
    const target = siteId || (sites.length === 1 ? String(sites[0].id) : "");
    router.push(`/(tabs)/${kind}/new?customerId=${id}${target ? `&siteId=${target}` : ""}` as never);
  }

  function confirmDelete() {
    const related = describeCounts(counts);
    confirmDestructive({
      entity: "customer",
      name: `"${title}"`,
      message: `This customer${related ? ` and their ${related}` : ""} will be permanently deleted. This can't be undone.`,
      onConfirm: async () => {
        try {
          await del.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Customer deleted", text2: title });
          router.dismissTo("/(tabs)/customers" as never);
        } catch (e) {
          showDeleteError("customer", e);
        }
      },
    });
  }

  const next = nextStep({ sites, surveys, measurements, estimates, projects, invoices, money });

  function runNext() {
    if (!next) return;
    switch (next.action) {
      case "site":
        router.push(`/(tabs)/sites/new?customerId=${id}` as never);
        break;
      case "survey":
      case "measurement":
      case "estimate":
        startNew(`${next.action}s` as WorkKind, next.siteId);
        break;
      case "openEstimate":
        if (next.estimateId) drawer.open(next.estimateId);
        break;
      case "project":
        if (next.projectId) router.push(`/(tabs)/projects/${next.projectId}` as never);
        break;
      case "payment":
        router.push(
          (next.invoiceId ? `/(tabs)/payments/new?invoiceId=${next.invoiceId}` : `/(tabs)/payments/new?customerId=${id}`) as never,
        );
        break;
    }
  }

  if (summaryQ.isLoading && !cached) {
    return (
      <SoftBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.pad}>
            <ScreenHeader title="Customer" onBack={back} />
          </View>
          <ActivityIndicator color={p.clay} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </SoftBackground>
    );
  }

  if (summaryQ.isError && !data) {
    return (
      <SoftBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.pad}>
            <ScreenHeader title="Customer" onBack={back} />
            <ErrorBanner
              message={(summaryQ.error as { userMessage?: string })?.userMessage || "Couldn't load this customer."}
              onRetry={() => summaryQ.refetch()}
            />
          </View>
        </SafeAreaView>
      </SoftBackground>
    );
  }

  const business = customer.type === "company";
  const due = Number(money.outstanding || 0);

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={summaryQ.isRefetching} onRefresh={() => summaryQ.refetch()} tintColor={p.clay} />}
          stickyHeaderIndices={[3]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pad}>
            <ScreenHeader
              title="Customer"
              onBack={back}
              right={
                <Pressable style={styles.headerBtn} onPress={() => router.push(`/(tabs)/customers/${id}/edit` as never)} accessibilityLabel="Edit customer">
                  <Pencil size={18} color={p.text} strokeWidth={2.3} />
                </Pressable>
              }
            />
          </View>

          <View style={[styles.pad, { marginBottom: spacing.md }]}>
            <View style={styles.profile}>
              <View style={styles.profileTop}>
                <Avatar name={title} seed={String(id)} size={60} icon={business ? Building2 : undefined} shape={business ? "rounded" : "circle"} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[business && customer.company ? String(customer.name || "") : "", customerTypeLabel(customer.type), sourceLabel(customer.source)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </View>
              <View style={styles.quick}>
                <Quick label="Call" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)} icon={<Phone size={18} color={p.clayDark} />} />
                <Quick
                  label="WhatsApp"
                  disabled={!phone}
                  onPress={() => shareViaWhatsApp({ phone, message: `Hello ${String(customer.name || "")},` }).catch(() => undefined)}
                  icon={<MessageCircle size={18} color="#15803D" />}
                />
                <Quick label="Email" disabled={!email} onPress={() => Linking.openURL(`mailto:${email}`)} icon={<Mail size={18} color={p.blue} />} />
              </View>
              <View style={styles.money}>
                <MoneyCell label="Due" value={formatCurrency(money.outstanding)} tone={due > 0 ? "red" : undefined} />
                <View style={styles.moneySep} />
                <MoneyCell label="Collected" value={formatCurrency(money.collected)} tone="green" />
                <View style={styles.moneySep} />
                <MoneyCell label="Billed" value={formatCurrency(money.billed)} />
              </View>
            </View>
          </View>

          {next ? (
            <View style={[styles.pad, { marginBottom: spacing.md }]}>
              <Pressable style={styles.next} onPress={runNext} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextLabel}>Next step</Text>
                  <Text style={styles.nextTitle}>{next.title}</Text>
                  {next.detail ? <Text style={styles.nextDetail}>{next.detail}</Text> : null}
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
                { key: "details", label: "Details" },
                { key: "sites", label: `Sites${sites.length ? ` ${sites.length}` : ""}` },
                { key: "surveys", label: `Surveys${surveys.length ? ` ${surveys.length}` : ""}` },
                { key: "measurements", label: `Measurements${measurements.length ? ` ${measurements.length}` : ""}` },
                { key: "estimates", label: `Estimates${estimates.length ? ` ${estimates.length}` : ""}` },
                { key: "money", label: "Money" },
              ]}
            />
          </View>

          <View style={styles.pad}>
            {tab === "details" ? (
              <>
                <Card title="Contact & billing" action={{ label: "Edit", onPress: () => router.push(`/(tabs)/customers/${id}/edit` as never) }}>
                  <Field label="Phone" value={phone} />
                  <Field label="Alternate phone" value={customer.alternatePhone} />
                  <Field label="Email" value={email} />
                  <Field label="Billing address" value={customer.billingAddress || customer.address} directions />
                  {business ? <Field label="GSTIN" value={customer.gstin} /> : null}
                  <Field label="Notes" value={customer.notes} />
                  <Field label="Customer since" value={customer.createdAt ? formatDate(String(customer.createdAt)) : ""} last />
                </Card>

                <Card title={`Follow-ups${followUps.length ? ` · ${followUps.length}` : ""}`}>
                  <FollowUpsCard customerId={String(id)} followUps={followUps} />
                </Card>

                <Card title="Activity log">
                  <ActivityLog events={activity} />
                </Card>

                <Pressable style={[styles.danger, del.isPending && { opacity: 0.6 }]} onPress={confirmDelete} disabled={del.isPending}>
                  {del.isPending ? (
                    <ActivityIndicator color={p.red} />
                  ) : (
                    <>
                      <Trash2 size={18} color={p.red} strokeWidth={2.4} />
                      <Text style={styles.dangerText}>Delete customer</Text>
                    </>
                  )}
                </Pressable>
                <Text style={styles.dangerHint}>Customers with invoices, payments or projects can't be deleted.</Text>
              </>
            ) : null}

            {tab === "sites" ? (
              <>
                <AddButton label="Add site" onPress={() => router.push(`/(tabs)/sites/new?customerId=${id}` as never)} />
                {sites.length === 0 ? (
                  <EmptyState title="No sites yet" subtitle="A site is the place you'll work at — a flat, house or office. Surveys, measurements and estimates are recorded per site." />
                ) : null}
                {sites.map((s) => (
                  <SiteRow key={String(s.id)} site={s} onPress={() => router.push(sitePath(String(s.id), { customerId: String(id) }) as never)} />
                ))}
              </>
            ) : null}

            {tab === "surveys" ? (
              <>
                <AddButton label="New survey" onPress={() => startNew("surveys")} />
                {surveys.length === 0 ? <EmptyState title="No surveys yet" subtitle="Record what the customer wants and the site's condition before measuring." /> : null}
                {surveys.map((s) => (
                  <SurveyRow key={String(s.id)} survey={s} siteName={siteName(s.siteId)} onPress={() => router.push(`/(tabs)/surveys/${s.id}` as never)} />
                ))}
              </>
            ) : null}

            {tab === "measurements" ? (
              <>
                <AddButton label="New measurement" onPress={() => startNew("measurements")} />
                {measurements.length === 0 ? <EmptyState title="No measurements yet" subtitle="Measure rooms, walls and openings — the totals become estimate lines." /> : null}
                {measurements.map((m) => (
                  <MeasurementRow key={String(m.id)} measurement={m} siteName={siteName(m.siteId)} onPress={() => router.push(`/(tabs)/measurements/${m.id}` as never)} />
                ))}
              </>
            ) : null}

            {tab === "estimates" ? (
              <>
                <AddButton label="New estimate" onPress={() => startNew("estimates")} />
                {estimates.length === 0 ? <EmptyState title="No estimates yet" subtitle="Price the measured work, materials and tool charges, then send the PDF." /> : null}
                {estimates.map((e) => (
                  <EstimateRow key={String(e.id)} estimate={e} siteName={siteName(e.siteId)} onPress={() => drawer.open(String(e.id))} />
                ))}
              </>
            ) : null}

            {tab === "money" ? (
              <MoneyTab
                money={money}
                projects={projects}
                invoices={invoices}
                payments={payments}
                onProject={(pid) => router.push(`/(tabs)/projects/${pid}` as never)}
                onInvoice={(iid) => invoiceDrawer.open(iid)}
                onPayment={(pid) => router.push(`/(tabs)/payments/${pid}` as never)}
              />
            ) : null}
          </View>
        </ScrollView>
        {drawer.element}
        {invoiceDrawer.element}
      </SafeAreaView>
    </SoftBackground>
  );
}

type Next = {
  title: string;
  detail?: string;
  action: "site" | "survey" | "measurement" | "estimate" | "openEstimate" | "project" | "payment";
  siteId?: string;
  estimateId?: string;
  projectId?: string;
  invoiceId?: string;
};

/** The single most useful thing to do next for this customer. */
function nextStep(d: {
  sites: Row[];
  surveys: Row[];
  measurements: Row[];
  estimates: Row[];
  projects: Row[];
  invoices: Row[];
  money: Record<string, string>;
}): Next | null {
  if (!d.sites.length) return { title: "Add the customer's site", detail: "Where will the work happen?", action: "site" };
  const approved = d.estimates.find((e) => e.status === "approved" && !e.projectId);
  if (approved) return { title: `Start the project for ${String(approved.number || "the approved estimate")}`, detail: "The estimate is approved.", action: "openEstimate", estimateId: String(approved.id) };
  const changes = d.estimates.find((e) => e.status === "changes_requested");
  if (changes) return { title: `Revise ${String(changes.number || "the estimate")}`, detail: "The customer asked for changes.", action: "openEstimate", estimateId: String(changes.id) };
  const draft = d.estimates.find((e) => e.status === "draft");
  if (draft) return { title: `Send ${String(draft.number || "the draft estimate")} to the customer`, detail: "Review the PDF and share it.", action: "openEstimate", estimateId: String(draft.id) };
  if (Number(d.money.outstanding || 0) > 0) {
    const unpaid = d.invoices.filter((i) => i.status !== "void" && Number(i.outstanding || 0) > 0);
    return {
      title: `Collect ${formatCurrency(d.money.outstanding)} due`,
      detail: unpaid.length === 1 ? `${String(unpaid[0].number || "Invoice")} is unpaid.` : "Record a payment when it arrives.",
      action: "payment",
      invoiceId: unpaid.length === 1 ? String(unpaid[0].id) : undefined,
    };
  }
  for (const s of d.sites) {
    const c = (s.counts as Record<string, number>) || {};
    const name = String(s.name || "the site");
    if (!c.surveys && !c.measurements && !c.estimates) return { title: `Record a survey for ${name}`, detail: "Note requirements and site conditions.", action: "survey", siteId: String(s.id) };
    if (!c.measurements && !c.estimates) return { title: `Measure ${name}`, detail: "Rooms, walls, openings.", action: "measurement", siteId: String(s.id) };
    if (!c.estimates) return { title: `Prepare an estimate for ${name}`, detail: "Use the measured quantities.", action: "estimate", siteId: String(s.id) };
  }
  const running = d.projects.find((pr) => pr.status !== "completed" && pr.status !== "cancelled");
  if (running) return { title: `Open project ${String(running.number || running.name || "")}`.trim(), detail: "Track progress, costs and invoices.", action: "project", projectId: String(running.id) };
  return null;
}

function MoneyTab({
  money,
  projects,
  invoices,
  payments,
  onProject,
  onInvoice,
  onPayment,
}: {
  money: Record<string, string>;
  projects: Row[];
  invoices: Row[];
  payments: Row[];
  onProject: (id: string) => void;
  onInvoice: (id: string) => void;
  onPayment: (id: string) => void;
}) {
  const profit = Number(money.profit || 0);
  return (
    <>
      <View style={styles.grid}>
        <Stat label="Contract value" value={formatCurrency(money.contractValue)} hint="Projects incl. approved change orders" />
        <Stat label="Billed" value={formatCurrency(money.billed)} hint="Invoices raised (voids excluded)" />
        <Stat label="Collected" value={formatCurrency(money.collected)} hint="Payments received" tone="green" />
        <Stat label="Due" value={formatCurrency(money.outstanding)} hint="Unpaid invoice balance" tone={Number(money.outstanding || 0) > 0 ? "red" : undefined} />
        <Stat label="Not yet billed" value={formatCurrency(money.unbilled)} hint="Contract value − billed" />
        <Stat label="Expenses" value={formatCurrency(money.costs)} hint={`Expenses ${formatCurrency(money.expenses)} + materials ${formatCurrency(money.purchases)}`} />
        <Stat label="Profit so far" value={formatCurrency(money.profit)} hint="Collected − expenses" tone={profit < 0 ? "red" : "green"} wide />
      </View>

      <Text style={styles.section}>Projects</Text>
      {projects.length === 0 ? <Text style={styles.muted}>No projects yet. Approve an estimate and start a project.</Text> : null}
      {projects.map((pr) => (
        <ListRow
          key={String(pr.id)}
          title={String(pr.name || pr.number || "Project")}
          subtitle={[pr.number, String(pr.status || "").replace(/_/g, " ")].filter(Boolean).map(String).join(" · ")}
          value={formatCurrency(String(pr.contractValue || 0))}
          onPress={() => onProject(String(pr.id))}
        />
      ))}

      <Text style={styles.section}>Invoices</Text>
      {invoices.length === 0 ? <Text style={styles.muted}>No invoices yet.</Text> : null}
      {invoices.map((inv) => {
        const voided = inv.status === "void";
        const out = Number(inv.outstanding || 0);
        return (
          <ListRow
            key={String(inv.id)}
            title={String(inv.number || "Invoice")}
            subtitle={voided ? "Voided" : out > 0 ? `${formatCurrency(out)} due${inv.dueDate ? ` · by ${formatDate(String(inv.dueDate))}` : ""}` : "Paid"}
            value={formatCurrency(String(inv.total || inv.total_amount || 0))}
            muted={voided}
            onPress={() => onInvoice(String(inv.id))}
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
          onPress={() => onPayment(String(pay.id))}
        />
      ))}
    </>
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

function Card({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.cardAction}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, last, directions }: { label: string; value: unknown; last?: boolean; directions?: boolean }) {
  const text = String(value ?? "").trim();
  return (
    <View style={[styles.field, last && { borderBottomWidth: 0 }, directions && text ? styles.fieldRow : null]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, !text && { color: p.faint }]}>{text || "Not added"}</Text>
      </View>
      {directions && text ? <DirectionsButton place={null} address={text} label={label.toLowerCase()} size={34} /> : null}
    </View>
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

function Stat({ label, value, hint, tone, wide }: { label: string; value: string; hint: string; tone?: "red" | "green"; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && { width: "100%" }]}>
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

function ListRow({ title, subtitle, value, onPress, muted }: { title: string; subtitle: string; value: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable style={[styles.listRow, muted && { opacity: 0.55 }]} onPress={onPress}>
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
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  profile: { backgroundColor: p.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: p.border, padding: spacing.md, ...cardShadow },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { color: p.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  meta: { color: p.muted, fontSize: 13, marginTop: 3, fontWeight: "600" },
  quick: { flexDirection: "row", gap: 8, marginTop: 14 },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: p.background,
    borderWidth: 1,
    borderColor: p.border,
  },
  quickText: { color: p.text, fontSize: 12, fontWeight: "700" },
  money: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: p.border },
  moneyCell: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  moneySep: { width: 1, backgroundColor: p.border },
  moneyLabel: { color: p.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  moneyValue: { color: p.text, fontWeight: "800", marginTop: 4, fontSize: 16 },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.claySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.clayMid,
    padding: spacing.md,
  },
  nextLabel: { color: p.clayDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  nextTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginTop: 3 },
  nextDetail: { color: p.muted, fontSize: 13, marginTop: 2 },
  nextGo: { width: 38, height: 38, borderRadius: 19, backgroundColor: p.clay, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { color: p.text, fontSize: 16, fontWeight: "800" },
  cardAction: { color: p.clayDark, fontWeight: "800" },
  field: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldLabel: { color: p.muted, fontSize: 12, fontWeight: "700" },
  fieldValue: { color: p.text, fontSize: 15, marginTop: 2 },
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
  },
  dangerText: { color: p.red, fontWeight: "700", fontSize: 15 },
  dangerHint: { color: p.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginBottom: 12,
  },
  addText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 12 },
  statLabel: { color: p.muted, fontSize: 12, fontWeight: "700" },
  statValue: { color: p.text, fontSize: 18, fontWeight: "800", marginTop: 4 },
  statHint: { color: p.faint, fontSize: 11, marginTop: 3 },
  section: { color: p.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginTop: spacing.md, marginBottom: 8 },
  muted: { color: p.muted, fontSize: 13, marginBottom: 6 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    padding: 12,
    marginBottom: 8,
  },
  listTitle: { color: p.text, fontWeight: "700" },
  listSub: { color: p.muted, fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  listValue: { color: p.text, fontWeight: "800" },
});
