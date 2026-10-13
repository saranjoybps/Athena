import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useCustomer,
  useCrews,
  useExpenses,
  useInvoices,
  useProject,
  useProjectProfitability,
  usePrefetchDetail,
  useProjectSchedules,
  useUpdateProject,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { WhatsAppShareButton } from "@/components/ui/WhatsAppShareButton";
import { formatCurrency } from "@/lib/format";
import { parseProjectTab, type ProjectTab } from "@/lib/nav";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { cardShadow, lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function ProjectHub() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tabFromUrl = parseProjectTab(tabParam) || "details";
  const [tab, setTab] = useState<ProjectTab>(tabFromUrl);
  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = useProject(id);
  const moneyEnabled = tab === "money";
  const profit = useProjectProfitability(id, moneyEnabled);
  const expenses = useExpenses(id, moneyEnabled);
  const invoices = useInvoices(moneyEnabled);
  const schedulesQ = useProjectSchedules(id);
  const crewsQ = useCrews();
  const customerId = data?.customerId ? String(data.customerId) : "";
  const { data: customer } = useCustomer(customerId || undefined);
  const update = useUpdateProject();
  const prefetch = usePrefetchDetail();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ""));
    setStatus(String(data.status || "scheduled"));
    setNotes(String(data.internalNotes || ""));
  }, [data]);

  const statusOptions = useMemo(() => ["scheduled", "active", "on_hold", "completed"], []);
  const projectInvoices = useMemo(
    () => (invoices.data?.items || []).filter((i) => String(i.projectId) === String(id)),
    [invoices.data, id],
  );

  const projectSchedules = schedulesQ.data?.items || [];

  const moneyStats = useMemo(() => {
    const billed = Number(profit.data?.billed ?? data?.billedToDate ?? 0) || 0;
    const received = Number(profit.data?.actualRevenue ?? 0) || 0;
    const outstanding = Math.max(0, billed - received);
    const profitVal = Number(profit.data?.actualProfit ?? 0) || 0;
    const loss = profitVal < 0 ? Math.abs(profitVal) : 0;
    return { billed, received, outstanding, loss, profitVal };
  }, [profit.data, data]);

  const customerPhone = String(customer?.phone || "").trim();
  const waMessage = `Hi${customer?.name ? ` ${customer.name}` : ""},\n\nRegarding project ${String(data?.name || data?.number || "")}.\n\nThank you.`;

  function goTab(next: ProjectTab) {
    setTab(next);
    router.setParams({ tab: next });
  }

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({
        id: String(id),
        body: {
          name,
          status,
          internalNotes: notes || null,
        },
      });
      Toast.show({ type: "success", text1: "Project saved" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isPlaceholderData}
            onRefresh={() => {
              refetch();
              if (moneyEnabled) {
                profit.refetch();
                expenses.refetch();
                invoices.refetch();
              }
            }}
            tintColor={p.clay}
          />
        }
      >
        <ScreenHeader
          title={String(data?.name || "Project")}
          subtitle={String(data?.number || "")}
          onBack={() => router.replace("/(tabs)/projects" as never)}
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} /> : null}

        {data ? (
          <>
            <SegmentTabs
              value={tab}
              onChange={goTab}
              tabs={[
                { key: "details", label: "Details" },
                { key: "money", label: "Money" },
              ]}
            />

            {tab === "money" ? (
              <>
                {profit.isLoading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 8 }} /> : null}
                <View style={styles.stats}>
                  <MoneyStat label="Received" value={formatCurrency(String(moneyStats.received))} />
                  <MoneyStat label="Outstanding" value={formatCurrency(String(moneyStats.outstanding))} />
                  <MoneyStat
                    label={moneyStats.loss > 0 ? "Loss" : "Profit"}
                    value={formatCurrency(String(moneyStats.loss > 0 ? moneyStats.loss : moneyStats.profitVal))}
                  />
                  <MoneyStat label="Billed" value={formatCurrency(String(moneyStats.billed))} />
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.btn}
                    onPress={() => router.push(`/(tabs)/invoices/new?projectId=${id}` as never)}
                  >
                    <Text style={styles.btnText}>Create invoice</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnGhost}
                    onPress={() => router.push(`/(tabs)/expenses/new?projectId=${id}` as never)}
                  >
                    <Text style={styles.btnGhostText}>Add expense</Text>
                  </Pressable>
                </View>

                <Text style={styles.section}>Invoices</Text>
                {projectInvoices.length === 0 ? <EmptyState title="No invoices on this project" /> : null}
                {projectInvoices.map((i) => (
                  <RecordCard
                    key={String(i.id)}
                    title={String(i.number || i.id)}
                    subtitle={`${formatCurrency(String(i.total || i.total_amount || "0"))} · due ${formatCurrency(String(i.outstanding || "0"))}`}
                    status={String(i.status || "")}
                    onPress={() => {
                      prefetch("invoices", i.id);
                      router.push(`/(tabs)/invoices/${i.id}?projectId=${id}` as never);
                    }}
                  />
                ))}

                <Text style={styles.section}>Expenses</Text>
                {(expenses.data?.items || []).length === 0 ? <Text style={styles.empty}>No expenses yet.</Text> : null}
                {(expenses.data?.items || []).slice(0, 12).map((e) => (
                  <RecordCard
                    key={String(e.id)}
                    title={`${formatCurrency(String(e.amount))} · ${String(e.category || "")}`}
                    subtitle={String(e.description || "")}
                    onPress={() => {
                      prefetch("expenses", e.id);
                      router.push(`/(tabs)/expenses/${e.id}?projectId=${id}` as never);
                    }}
                  />
                ))}
              </>
            ) : null}

            {tab === "details" ? (
              <View style={styles.card}>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
                <Text style={styles.label}>Status</Text>
                <View style={styles.chips}>
                  {statusOptions.map((s) => (
                    <Pressable key={s} style={[styles.chip, status === s && styles.chipOn]} onPress={() => setStatus(s)}>
                      <Text style={[styles.chipText, status === s && styles.chipTextOn]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Scheduled crews</Text>
                {schedulesQ.isLoading ? <ActivityIndicator color={p.clay} /> : null}
                {projectSchedules.length === 0 ? (
                  <Text style={styles.empty}>No crew scheduled yet.</Text>
                ) : (
                  projectSchedules.map((s) => {
                    const crew = (crewsQ.data?.items || []).find((c) => String(c.id) === String(s.crewId || ""));
                    return (
                      <View key={String(s.id)} style={styles.scheduleRow}>
                        <Text style={styles.customerName}>{String(crew?.name || s.crewId || "Crew")}</Text>
                        <Text style={styles.phone}>
                          {String(s.startDate || "").slice(0, 10)} → {String(s.endDate || s.startDate || "").slice(0, 10)}
                        </Text>
                      </View>
                    );
                  })
                )}
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => router.push("/(tabs)/more/schedule/new" as never)}
                >
                  <Text style={styles.btnGhostText}>Add schedule</Text>
                </Pressable>
                {customer ? (
                  <View style={styles.contactRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Customer</Text>
                      <Text style={styles.customerName}>{String(customer.name || "—")}</Text>
                      {customerPhone ? <Text style={styles.phone}>{customerPhone}</Text> : null}
                    </View>
                    {customerPhone ? (
                      <View style={styles.contactActions}>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => Linking.openURL(`tel:${customerPhone}`)}
                          accessibilityLabel="Call customer"
                        >
                          <Text style={styles.iconBtnText}>📞</Text>
                        </Pressable>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() =>
                            shareViaWhatsApp({ phone: customerPhone, message: waMessage }).catch((e) =>
                              Toast.show({ type: "error", text1: "Could not open WhatsApp", text2: (e as Error).message }),
                            )
                          }
                          accessibilityLabel="WhatsApp customer"
                        >
                          <WhatsAppShareButton phone={customerPhone} message={waMessage} label="WhatsApp" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.label}>Internal notes</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholderTextColor={p.faint}
                />
                <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
                  <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance, gap: 8 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 12, marginBottom: 8 },
  empty: { color: p.muted, marginBottom: 8 },
  rowActions: { flexDirection: "row", gap: 8, marginVertical: 4 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, ...cardShadow },
  statLabel: { color: p.muted, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  statValue: { color: p.text, fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 8,
    ...cardShadow,
  },
  label: { color: p.muted, fontSize: 13, fontWeight: "600", marginTop: 4 },
  customerName: { color: p.text, fontWeight: "700", fontSize: 16, marginTop: 2 },
  phone: { color: p.muted, fontWeight: "600", fontSize: 14, marginTop: 2 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: p.border,
  },
  contactActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.background,
  },
  iconBtnText: { fontSize: 20 },
  input: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: p.text,
    backgroundColor: p.background,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  chipTextOn: { color: p.clayDark },
  btn: { flex: 1, backgroundColor: p.clay, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
  btnGhost: {
    flex: 1,
    backgroundColor: p.claySoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: p.clayMid,
  },
  btnGhostText: { color: p.clayDark, fontWeight: "700" },
  scheduleRow: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: p.background,
    marginBottom: 6,
  },
});
