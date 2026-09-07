import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useExpenses, useProject, useProjectProfitability, useSnags, useUpdateProject } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

type Tab = "actions" | "money" | "details";

export default function ProjectHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("actions");
  const { data, isLoading, isError, error, refetch, isRefetching } = useProject(id);
  const profit = useProjectProfitability(id);
  const expenses = useExpenses(id);
  const snags = useSnags();
  const update = useUpdateProject();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ""));
    setStatus(String(data.status || "scheduled"));
    setNotes(String(data.internalNotes || ""));
  }, [data]);

  const statusOptions = useMemo(() => ["scheduled", "active", "on_hold", "completed"], []);
  const projectSnags = useMemo(
    () => (snags.data?.items || []).filter((s) => String(s.projectId) === String(id)),
    [snags.data, id],
  );

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({
        id: String(id),
        body: { name, status, internalNotes: notes || null },
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
      <ConnectionBanner />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              profit.refetch();
              expenses.refetch();
              snags.refetch();
            }}
            tintColor={p.clay}
          />
        }
      >
        <ScreenHeader title={String(data?.name || "Project")} subtitle={String(data?.number || "")} onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} /> : null}

        {data ? (
          <>
            <View style={styles.links}>
              {data.customerId ? (
                <Pressable onPress={() => router.push(`/(tabs)/customers/${data.customerId}` as never)}>
                  <Text style={styles.link}>Customer CRM →</Text>
                </Pressable>
              ) : null}
              {data.siteId ? (
                <Pressable onPress={() => router.push(`/(tabs)/sites/${data.siteId}` as never)}>
                  <Text style={styles.link}>Site hub →</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.tabs}>
              {(
                [
                  ["actions", "Field"],
                  ["money", "Money"],
                  ["details", "Details"],
                ] as const
              ).map(([key, label]) => (
                <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
                  <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {tab === "actions" ? (
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

            {tab === "money" ? (
              <>
                <View style={styles.stats}>
                  <MoneyStat label="Contract" value={formatCurrency(String(profit.data?.contractValue ?? data.contractValue ?? 0))} />
                  <MoneyStat label="Billed" value={formatCurrency(String(profit.data?.billed ?? data.billedToDate ?? 0))} />
                  <MoneyStat label="Collected" value={formatCurrency(String(profit.data?.actualRevenue ?? 0))} />
                  <MoneyStat label="Profit" value={formatCurrency(String(profit.data?.actualProfit ?? 0))} />
                </View>
                <Pressable style={styles.action} onPress={() => router.push("/(tabs)/more/accounts" as never)}>
                  <Text style={styles.actionText}>Open Accounts</Text>
                  <Text style={styles.chev}>→</Text>
                </Pressable>
                <Text style={styles.section}>Expenses</Text>
                {(expenses.data?.items || []).length === 0 ? <Text style={styles.empty}>No expenses yet.</Text> : null}
                {(expenses.data?.items || []).slice(0, 8).map((e) => (
                  <RecordCard
                    key={String(e.id)}
                    title={`${formatCurrency(String(e.amount))} · ${String(e.category || "")}`}
                    subtitle={String(e.description || "")}
                    onPress={() => router.push(`/(tabs)/expenses/${e.id}` as never)}
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
  content: { padding: spacing.lg, paddingBottom: 48, gap: 8 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 4 },
  link: { color: p.clay, fontWeight: "700", fontSize: 14 },
  tabs: { flexDirection: "row", gap: 8, marginVertical: 8 },
  tab: { backgroundColor: p.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: p.border },
  tabOn: { backgroundColor: p.clay, borderColor: p.clay },
  tabText: { color: p.text, fontWeight: "600", fontSize: 13 },
  tabTextOn: { color: "#fff" },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 12, marginBottom: 8 },
  empty: { color: p.muted, marginBottom: 8 },
  action: {
    backgroundColor: p.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: p.border,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    alignItems: "center",
  },
  actionText: { color: p.text, fontWeight: "600", fontSize: 15 },
  chev: { color: p.clay, fontWeight: "700" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border },
  statLabel: { color: p.muted, fontSize: 11, textTransform: "uppercase" },
  statValue: { color: p.text, fontWeight: "700", marginTop: 4 },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 8,
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
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  chipTextOn: { color: p.clay },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
});
