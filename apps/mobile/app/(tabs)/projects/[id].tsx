import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useExpenses,
  useInvoices,
  useProject,
  useProjectProfitability,
  useSnags,
  useUpdateProject,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { DateField } from "@/components/ui/DateField";
import { formatCurrency, formatDate } from "@/lib/format";
import { parseProjectTab, type ProjectTab } from "@/lib/nav";
import { cardShadow, lightPalette as p, radius, spacing } from "@/lib/theme";

export default function ProjectHub() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tabFromUrl = parseProjectTab(tabParam) || "details";
  const [tab, setTab] = useState<ProjectTab>(tabFromUrl);
  const { data, isLoading, isError, error, refetch, isRefetching } = useProject(id);
  const moneyEnabled = tab === "money";
  const fieldEnabled = tab === "field";
  const profit = useProjectProfitability(id, moneyEnabled);
  const expenses = useExpenses(id, moneyEnabled);
  const invoices = useInvoices(moneyEnabled);
  const snags = useSnags(fieldEnabled);
  const update = useUpdateProject();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedCompletion, setExpectedCompletion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ""));
    setStatus(String(data.status || "scheduled"));
    setNotes(String(data.internalNotes || ""));
    setStartDate(String(data.startDate || "").slice(0, 10));
    setExpectedCompletion(String(data.expectedCompletion || "").slice(0, 10));
  }, [data]);

  const statusOptions = useMemo(() => ["scheduled", "active", "on_hold", "completed"], []);
  const projectSnags = useMemo(
    () => (snags.data?.items || []).filter((s) => String(s.projectId) === String(id)),
    [snags.data, id],
  );
  const projectInvoices = useMemo(
    () => (invoices.data?.items || []).filter((i) => String(i.projectId) === String(id)),
    [invoices.data, id],
  );

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
          startDate: startDate || null,
          expectedCompletion: expectedCompletion || null,
        },
      });
      Toast.show({ type: "success", text1: "Project saved" });
      refetch();
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
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              if (moneyEnabled) {
                profit.refetch();
                expenses.refetch();
                invoices.refetch();
              }
              if (fieldEnabled) snags.refetch();
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
                { key: "field", label: "Field" },
              ]}
            />

            {tab === "money" ? (
              <>
                <View style={styles.stats}>
                  <MoneyStat label="Contract" value={formatCurrency(String(profit.data?.contractValue ?? data.contractValue ?? 0))} />
                  <MoneyStat label="Billed" value={formatCurrency(String(profit.data?.billed ?? data.billedToDate ?? 0))} />
                  <MoneyStat label="Collected" value={formatCurrency(String(profit.data?.actualRevenue ?? 0))} />
                  <MoneyStat label="Profit" value={formatCurrency(String(profit.data?.actualProfit ?? 0))} />
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
                    onPress={() => router.push(`/(tabs)/invoices/${i.id}?projectId=${id}` as never)}
                  />
                ))}

                <Text style={styles.section}>Expenses</Text>
                {(expenses.data?.items || []).length === 0 ? <Text style={styles.empty}>No expenses yet.</Text> : null}
                {(expenses.data?.items || []).slice(0, 12).map((e) => (
                  <RecordCard
                    key={String(e.id)}
                    title={`${formatCurrency(String(e.amount))} · ${String(e.category || "")}`}
                    subtitle={String(e.description || "")}
                    onPress={() => router.push(`/(tabs)/expenses/${e.id}?projectId=${id}` as never)}
                  />
                ))}
              </>
            ) : null}

            {tab === "field" ? (
              <>
                <Text style={styles.section}>Quick field actions</Text>
                {[
                  { label: "Log expense", href: `/(tabs)/expenses/new?projectId=${id}` },
                  { label: "Log snag", href: `/(tabs)/snags/new?projectId=${id}` },
                  { label: "Change order", href: `/(tabs)/change-orders/new?projectId=${id}` },
                  { label: "Mark attendance", href: "/(tabs)/attendance" },
                ].map((a) => (
                  <Pressable key={a.href} style={styles.action} onPress={() => router.push(a.href as never)}>
                    <Text style={styles.actionText}>{a.label}</Text>
                    <Text style={styles.chev}>→</Text>
                  </Pressable>
                ))}

                <Text style={styles.section}>Open snags ({projectSnags.length})</Text>
                {projectSnags.length === 0 ? <Text style={styles.empty}>No snags on this project.</Text> : null}
                {projectSnags.slice(0, 5).map((s) => (
                  <RecordCard
                    key={String(s.id)}
                    title={String(s.location || s.description || s.id)}
                    subtitle={`${String(s.status || "")} · ${formatDate(String(s.createdAt || ""))}`}
                    onPress={() => router.push("/(tabs)/snags" as never)}
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
                <DateField label="Start date" value={startDate} onChange={setStartDate} />
                <DateField label="Expected completion" value={expectedCompletion} onChange={setExpectedCompletion} />
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
  content: { padding: spacing.lg, paddingBottom: 110, gap: 8 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 12, marginBottom: 8 },
  empty: { color: p.muted, marginBottom: 8 },
  rowActions: { flexDirection: "row", gap: 8, marginVertical: 4 },
  action: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: p.border,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    alignItems: "center",
    ...cardShadow,
  },
  actionText: { color: p.text, fontWeight: "600", fontSize: 15 },
  chev: { color: p.clay, fontWeight: "700" },
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
});
