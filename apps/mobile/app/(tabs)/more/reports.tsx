import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useAccounts,
  useAttendance,
  useDailyExpensesReport,
  useGstSummary,
  useGstr1Report,
  useGstr2bReport,
  useInventoryReport,
  useMeasurementReport,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance, softShadow } from "@/lib/theme";

type Tab = "overview" | "measurements" | "inventory" | "expenses" | "gstr1" | "gstr2b";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "measurements", label: "Meas." },
  { key: "inventory", label: "Stock" },
  { key: "expenses", label: "Daily" },
  { key: "gstr1", label: "GSTR-1" },
  { key: "gstr2b", label: "GSTR-2B" },
];

export default function ReportsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const accounts = useAccounts();
  const attendance = useAttendance();
  const gst = useGstSummary();
  const measurements = useMeasurementReport();
  const inventory = useInventoryReport();
  const expenses = useDailyExpensesReport();
  const gstr1 = useGstr1Report();
  const gstr2b = useGstr2bReport();

  const pl = ((accounts.data?.pl || accounts.data || {}) as Record<string, unknown>) || {};
  const rows = attendance.data?.items || [];
  const present = rows.filter((a) => ["present", "half_day"].includes(String(a.status))).length;
  const absent = rows.filter((a) => String(a.status) === "absent").length;

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <ScreenHeader title="Reports" subtitle="Accounts, stock & GST" onBack={() => router.back()} />
        </View>
        {accounts.isError ? (
          <View style={styles.pad}>
            <ErrorBanner
              message={(accounts.error as { userMessage?: string })?.userMessage || "Failed"}
              onRetry={() => accounts.refetch()}
            />
          </View>
        ) : null}

        <SegmentTabs tabs={TABS} value={tab} onChange={setTab} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "overview" ? (
            <>
              {accounts.isLoading ? <ActivityIndicator color={p.clay} /> : null}
              <Text style={styles.section}>Accounts</Text>
              <View style={styles.grid}>
                <Stat label="Collected" value={formatCurrency(String(pl.collections ?? 0))} />
                <Stat label="Outstanding" value={formatCurrency(String(pl.outstanding ?? 0))} />
                <Stat label="Costs" value={formatCurrency(String(pl.costs ?? 0))} />
                <Stat label="Net" value={formatCurrency(String(pl.net ?? 0))} />
              </View>
              <Text style={styles.section}>GST summary</Text>
              <View style={styles.grid}>
                <Stat label="Output" value={formatCurrency(String(gst.data?.outputTax ?? 0))} />
                <Stat label="Input" value={formatCurrency(String(gst.data?.inputTax ?? 0))} />
                <Stat label="Net" value={formatCurrency(String(gst.data?.net ?? 0))} />
              </View>
              <Text style={styles.section}>Attendance</Text>
              <View style={styles.grid}>
                <Stat label="Records" value={String(rows.length)} />
                <Stat label="Present / half" value={String(present)} />
                <Stat label="Absent" value={String(absent)} />
              </View>
            </>
          ) : null}

          {tab === "measurements" ? (
            <>
              {measurements.isLoading ? <ActivityIndicator color={p.clay} /> : null}
              <Text style={styles.hint}>{String(measurements.data?.total ?? 0)} records</Text>
              {((measurements.data?.items as Record<string, unknown>[]) || []).map((site) => (
                <View key={String(site.siteId || site.siteName)} style={styles.card}>
                  <Text style={styles.cardTitle}>{String(site.siteName || "Unassigned")}</Text>
                  <Text style={styles.cardMeta}>{String(site.count)} measurements</Text>
                </View>
              ))}
            </>
          ) : null}

          {tab === "inventory" ? (
            <>
              {inventory.isLoading ? <ActivityIndicator color={p.clay} /> : null}
              {((inventory.data?.items as Record<string, unknown>[]) || []).map((row) => (
                <View key={String(row.id || row.materialId)} style={styles.card}>
                  <Text style={styles.cardTitle}>{String(row.name || row.materialName || "Item")}</Text>
                  <Text style={styles.cardMeta}>
                    On hand {String(row.onHand ?? row.qty ?? 0)}
                    {row.lowStock ? " · Low stock" : ""}
                  </Text>
                </View>
              ))}
              {!inventory.isLoading && !(inventory.data?.items ?? []).length ? (
                <Text style={styles.hint}>No stock rows yet.</Text>
              ) : null}
            </>
          ) : null}

          {tab === "expenses" ? (
            <>
              {expenses.isLoading ? <ActivityIndicator color={p.clay} /> : null}
              {((expenses.data?.items as Record<string, unknown>[]) || []).map((row) => (
                <View key={String(row.id || row.date)} style={styles.card}>
                  <Text style={styles.cardTitle}>{formatCurrency(String(row.amount || row.total || 0))}</Text>
                  <Text style={styles.cardMeta}>
                    {String(row.category || "Expense")} · {formatDate(String(row.date || row.createdAt || ""))}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          {tab === "gstr1" ? (
            <>
              {gstr1.isLoading ? <ActivityIndicator color={p.clay} /> : null}
              {((gstr1.data?.items as Record<string, unknown>[]) || []).map((row, idx) => (
                <View key={String(row.invoiceId || idx)} style={styles.row}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {String(row.number || row.invoiceId || "Invoice")}
                  </Text>
                  <Text style={styles.rowMeta}>{formatCurrency(String(row.taxable || row.total || 0))}</Text>
                </View>
              ))}
              {!gstr1.isLoading && !(gstr1.data?.items ?? []).length ? <Text style={styles.hint}>No outward invoices.</Text> : null}
            </>
          ) : null}

          {tab === "gstr2b" ? (
            <>
              {gstr2b.isLoading ? <ActivityIndicator color={p.clay} /> : null}
              {((gstr2b.data?.items as Record<string, unknown>[]) || []).map((row, idx) => (
                <View key={String(row.id || idx)} style={styles.row}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {String(row.supplier || row.number || "Purchase")}
                  </Text>
                  <Text style={styles.rowMeta}>{formatCurrency(String(row.taxable || row.total || 0))}</Text>
                </View>
              ))}
              {!gstr2b.isLoading && !(gstr2b.data?.items ?? []).length ? <Text style={styles.hint}>No purchases yet.</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pad: { paddingHorizontal: spacing.lg },
  content: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: tabBarClearance },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  hint: { color: p.muted, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    ...softShadow,
  },
  statLabel: { color: p.muted, fontSize: 12, fontWeight: "600" },
  statValue: { color: p.text, fontSize: 18, fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 8,
    ...softShadow,
  },
  cardTitle: { color: p.text, fontWeight: "700" },
  cardMeta: { color: p.muted, marginTop: 4, fontSize: 13 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  rowTitle: { flex: 1, color: p.text, fontWeight: "600" },
  rowMeta: { color: p.muted, fontWeight: "700" },
});
