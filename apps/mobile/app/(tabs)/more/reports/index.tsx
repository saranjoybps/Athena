import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileText,
  Package,
  Receipt,
  Ruler,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PeriodPicker } from "@/components/reports/PeriodPicker";
import { useReportPeriod } from "@/hooks/useApi";
import { hasPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store";
import { formatCurrency } from "@/lib/format";
import {
  expenseCategoryLabel,
  periodFromParams,
  periodLabel,
  periodParams,
  type PeriodReport,
  type ReportPeriod,
  type ReportSection,
} from "@/lib/reportPeriod";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export default function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; year?: string; month?: string }>();
  const [period, setPeriod] = useState<ReportPeriod>(() => periodFromParams(params));
  const canView = useAuthStore((s) => hasPermission(s.user, "accounting.read"));
  const q = useReportPeriod(period.mode, period.year, period.month, canView);
  const report = q.data;
  const switching = q.isFetching && q.isPlaceholderData;

  function open(section: ReportSection) {
    router.push({ pathname: "/(tabs)/more/reports/[section]", params: { section, ...periodParams(period) } } as never);
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={q.isRefetching && !switching} onRefresh={() => q.refetch()} />}
        >
          <ScreenHeader title="Reports" subtitle="Profit, GST, receivables & ledger" onBack={() => router.back()} />
          {!canView ? (
            <EmptyState title="Reports are restricted" subtitle="Ask your workspace owner for accounts access to view reports." />
          ) : (
            <PeriodPicker value={period} onChange={setPeriod} />
          )}

          {q.isLoading ? <ActivityIndicator color={p.clay} style={{ marginTop: 32 }} /> : null}
          {q.isError && !report ? (
            <View style={{ marginTop: spacing.md }}>
              <ErrorBanner
                message={(q.error as { userMessage?: string })?.userMessage || "Couldn't load this report."}
                onRetry={() => q.refetch()}
              />
            </View>
          ) : null}

          {report ? (
            <View style={[styles.report, switching && styles.dimmed]}>
              <ProfitCard report={report} period={period} />
              <Tiles report={report} onOpen={open} />
              <TrendCard report={report} onDrill={(year, month) => setPeriod({ mode: "month", year, month })} />
              <ExpenseBreakdown report={report} onOpen={() => open("expenses")} />
              <TopCustomers report={report} />
              <AttendanceCard report={report} onOpen={() => router.push("/(tabs)/attendance" as never)} />
              <Text style={styles.section}>More reports</Text>
              <View style={styles.linkCard}>
                <LinkRow icon={BookOpen} label="Ledger" hint={`Entries posted in ${periodLabel(period)}`} onPress={() => open("ledger")} />
                <LinkRow
                  icon={Package}
                  label="Stock on hand"
                  hint="Current quantities for tools and materials"
                  onPress={() => router.push("/(tabs)/more/stock" as never)}
                  border
                />
                <LinkRow icon={Ruler} label="Measurements by site" hint="All recorded measurements" onPress={() => open("measurements")} border />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function ProfitCard({ report, period }: { report: PeriodReport; period: ReportPeriod }) {
  const net = Number(report.summary.net);
  const positive = net >= 0;
  return (
    <View style={[styles.hero, positive ? styles.heroPositive : styles.heroNegative]}>
      <Text style={styles.heroLabel}>{positive ? "Net profit" : "Net loss"} · {periodLabel(period)}</Text>
      <Text style={[styles.heroValue, { color: positive ? p.green : p.red }]}>{formatCurrency(report.summary.net)}</Text>
      <View style={styles.heroRow}>
        <Text style={styles.heroMeta}>Collected {formatCurrency(report.summary.collected)}</Text>
        <Text style={styles.heroMeta}>Costs {formatCurrency(report.summary.costs)}</Text>
      </View>
      {report.summary.margin != null ? (
        <View style={[styles.marginChip, { backgroundColor: positive ? p.greenSoft : p.redSoft }]}>
          <Text style={[styles.marginText, { color: positive ? p.green : p.red }]}>{report.summary.margin}% margin on collections</Text>
        </View>
      ) : null}
    </View>
  );
}

function Tiles({ report, onOpen }: { report: PeriodReport; onOpen: (s: ReportSection) => void }) {
  const s = report.summary;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const netTax = Number(s.netTax);
  const tiles: { key: ReportSection; label: string; value: string; hint: string; icon: LucideIcon; tint: string; color: string }[] = [
    { key: "invoices", label: "Billed", value: s.billed, hint: plural(s.invoiceCount, "invoice"), icon: FileText, tint: p.sky, color: p.blue },
    { key: "payments", label: "Collected", value: s.collected, hint: plural(s.paymentCount, "payment"), icon: Wallet, tint: p.mint, color: p.green },
    { key: "expenses", label: "Expenses", value: s.expenses, hint: plural(s.expenseCount, "expense"), icon: Receipt, tint: p.peach, color: p.clay },
    { key: "purchases", label: "Purchases", value: s.purchases, hint: plural(s.purchaseCount, "purchase"), icon: ShoppingCart, tint: p.butter, color: p.amber },
    {
      key: "gst",
      label: netTax >= 0 ? "GST payable" : "GST credit",
      value: String(Math.abs(netTax)),
      hint: `Out ${formatCurrency(s.outputTax)} · In ${formatCurrency(s.inputTax)}`,
      icon: BookOpen,
      tint: p.lilac,
      color: p.purple,
    },
    {
      key: "receivables",
      label: "Outstanding",
      value: s.outstandingNow,
      hint: `As of today · ${plural(s.openInvoiceCount, "invoice")}`,
      icon: ClipboardList,
      tint: p.redSoft,
      color: p.red,
    },
  ];
  return (
    <View style={styles.grid}>
      {tiles.map(({ key, label, value, hint, icon: Icon, tint, color }) => (
        <Pressable key={key} style={styles.tile} onPress={() => onOpen(key)} accessibilityRole="button" accessibilityLabel={label}>
          <View style={styles.tileHead}>
            <View style={[styles.tileIcon, { backgroundColor: tint }]}>
              <Icon size={16} color={color} strokeWidth={2.4} />
            </View>
            <ChevronRight size={16} color={p.faint} />
          </View>
          <Text style={styles.tileLabel}>{label}</Text>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(value)}
          </Text>
          <Text style={styles.tileHint} numberOfLines={1}>
            {hint}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TrendCard({ report, onDrill }: { report: PeriodReport; onDrill: (year: number, month: number) => void }) {
  const annual = report.period.mode === "year";
  const max = useMemo(
    () => Math.max(1, ...report.trend.flatMap((b) => [Number(b.collected), Number(b.costs)])),
    [report.trend],
  );
  const empty = report.trend.every((b) => Number(b.collected) === 0 && Number(b.costs) === 0);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{annual ? "Month by month" : "Week by week"}</Text>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: p.green }]} />
          <Text style={styles.legendText}>Collected</Text>
          <View style={[styles.dot, { backgroundColor: p.clay }]} />
          <Text style={styles.legendText}>Costs</Text>
        </View>
      </View>
      {empty ? <Text style={styles.emptyText}>No collections or costs recorded in this period.</Text> : null}
      {!empty
        ? report.trend.map((b) => {
            const drill = annual && b.year && b.month ? () => onDrill(b.year as number, b.month as number) : undefined;
            const net = Number(b.net);
            return (
              <Pressable key={b.key} style={styles.trendRow} onPress={drill} disabled={!drill}>
                <Text style={styles.trendLabel}>{b.label}</Text>
                <View style={styles.bars}>
                  <View style={[styles.bar, { backgroundColor: p.green, width: `${(Number(b.collected) / max) * 100}%` }]} />
                  <View style={[styles.bar, { backgroundColor: p.clay, width: `${(Number(b.costs) / max) * 100}%` }]} />
                </View>
                <Text style={[styles.trendNet, { color: net < 0 ? p.red : net > 0 ? p.green : p.faint }]} numberOfLines={1}>
                  {net === 0 ? "—" : formatCurrency(b.net)}
                </Text>
              </Pressable>
            );
          })
        : null}
      {annual && !empty ? <Text style={styles.footHint}>Tap a month to open its report.</Text> : null}
    </View>
  );
}

function ExpenseBreakdown({ report, onOpen }: { report: PeriodReport; onOpen: () => void }) {
  const total = Number(report.summary.expenses);
  if (!report.expenseByCategory.length) return null;
  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Where the money went</Text>
        <ChevronRight size={16} color={p.faint} />
      </View>
      {report.expenseByCategory.slice(0, 6).map((c) => {
        const share = total > 0 ? (Number(c.amount) / total) * 100 : 0;
        return (
          <View key={c.category} style={styles.catRow}>
            <View style={styles.catHead}>
              <Text style={styles.catLabel}>{expenseCategoryLabel(c.category)}</Text>
              <Text style={styles.catValue}>
                {formatCurrency(c.amount)} <Text style={styles.catShare}>{Math.round(share)}%</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${share}%` }]} />
            </View>
          </View>
        );
      })}
    </Pressable>
  );
}

function TopCustomers({ report }: { report: PeriodReport }) {
  const router = useRouter();
  if (!report.topCustomers.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Top customers</Text>
      {report.topCustomers.map((c, i) => (
        <Pressable
          key={c.customerId || `c-${i}`}
          style={[styles.custRow, i > 0 && styles.custBorder]}
          onPress={c.customerId ? () => router.push(`/(tabs)/customers/${c.customerId}` as never) : undefined}
          disabled={!c.customerId}
        >
          <Text style={styles.custRank}>{i + 1}</Text>
          <Text style={styles.custName} numberOfLines={1}>
            {c.customerName}
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.custValue}>{formatCurrency(c.billed)}</Text>
            <Text style={styles.custMeta}>Collected {formatCurrency(c.collected)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function AttendanceCard({ report, onOpen }: { report: PeriodReport; onOpen: () => void }) {
  const a = report.attendance;
  const stats = [
    { label: "Worker-days", value: a.workerDays },
    { label: "Present", value: String(a.present + a.overtime) },
    { label: "Half day", value: String(a.halfDay) },
    { label: "Absent", value: String(a.absent + a.leave) },
  ];
  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Attendance</Text>
        <Text style={styles.cardMeta}>
          {a.workers} worker{a.workers === 1 ? "" : "s"} · {a.records} record{a.records === 1 ? "" : "s"}
        </Text>
      </View>
      <View style={styles.statRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function LinkRow({ icon: Icon, label, hint, onPress, border }: { icon: LucideIcon; label: string; hint: string; onPress: () => void; border?: boolean }) {
  return (
    <Pressable style={[styles.linkRow, border && styles.linkBorder]} onPress={onPress}>
      <View style={styles.linkIcon}>
        <Icon size={18} color={p.clayDark} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkHint}>{hint}</Text>
      </View>
      <ChevronRight size={18} color={p.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  report: { marginTop: spacing.md, gap: spacing.md },
  dimmed: { opacity: 0.55 },
  hero: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, ...softShadow },
  heroPositive: { backgroundColor: p.greenSoft, borderColor: "#BBF7D0" },
  heroNegative: { backgroundColor: p.redSoft, borderColor: "#FECACA" },
  heroLabel: { color: p.muted, fontSize: 13, fontWeight: "700" },
  heroValue: { fontSize: 32, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  heroRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 8 },
  heroMeta: { color: p.text, fontSize: 13, fontWeight: "600" },
  marginChip: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  marginText: { fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    ...softShadow,
  },
  tileHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileLabel: { color: p.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  tileValue: { color: p.text, fontSize: 19, fontWeight: "800", marginTop: 4 },
  tileHint: { color: p.faint, fontSize: 12, marginTop: 3, fontWeight: "600" },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    ...softShadow,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { color: p.text, fontSize: 16, fontWeight: "800" },
  cardMeta: { color: p.muted, fontSize: 12, fontWeight: "600" },
  legend: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  legendText: { color: p.muted, fontSize: 11, fontWeight: "600" },
  emptyText: { color: p.muted, fontSize: 13 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  trendLabel: { width: 64, color: p.text, fontSize: 12, fontWeight: "700" },
  bars: { flex: 1, gap: 3 },
  bar: { height: 7, borderRadius: 4, minWidth: 2 },
  trendNet: { width: 84, textAlign: "right", fontSize: 12, fontWeight: "800" },
  footHint: { color: p.faint, fontSize: 12, marginTop: 8 },
  catRow: { marginBottom: 12 },
  catHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  catLabel: { color: p.text, fontWeight: "600", fontSize: 14 },
  catValue: { color: p.text, fontWeight: "800", fontSize: 14 },
  catShare: { color: p.faint, fontWeight: "700", fontSize: 12 },
  track: { height: 8, borderRadius: 4, backgroundColor: p.slateSoft, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: p.clay },
  custRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  custBorder: { borderTopWidth: 1, borderTopColor: p.border },
  custRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: p.claySoft, color: p.clayDark, textAlign: "center", lineHeight: 22, fontWeight: "800", fontSize: 12 },
  custName: { flex: 1, color: p.text, fontWeight: "700", fontSize: 14 },
  custValue: { color: p.text, fontWeight: "800", fontSize: 14 },
  custMeta: { color: p.faint, fontSize: 11, fontWeight: "600", marginTop: 1 },
  statRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: p.slateSoft, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  statValue: { color: p.text, fontSize: 17, fontWeight: "800" },
  statLabel: { color: p.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: -4,
  },
  linkCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    overflow: "hidden",
    ...softShadow,
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14 },
  linkBorder: { borderTopWidth: 1, borderTopColor: p.border },
  linkIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  linkLabel: { color: p.text, fontWeight: "700", fontSize: 15 },
  linkHint: { color: p.muted, fontSize: 12, marginTop: 2 },
});
