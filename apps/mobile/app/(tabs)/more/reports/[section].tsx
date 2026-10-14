import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BookOpen, FileText, MapPin, Receipt, ShoppingCart, UserRound, Wallet } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { ReportRow } from "@/components/reports/ReportRow";
import { useMeasurementReport, useReportPeriod } from "@/hooks/useApi";
import { useInvoiceDrawer } from "@/components/invoices/InvoiceDrawer";
import { formatCurrency } from "@/lib/format";
import {
  expenseCategoryLabel,
  periodFromParams,
  periodLabel,
  shortDate,
  type GstTotals,
  type PeriodReport,
  type ReportSection,
} from "@/lib/reportPeriod";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

const TITLES: Record<ReportSection, string> = {
  invoices: "Invoices billed",
  payments: "Payments collected",
  expenses: "Expenses",
  purchases: "Purchases",
  gst: "GST summary",
  receivables: "Outstanding",
  ledger: "Ledger",
  measurements: "Measurements by site",
};

type Row = { key: string; date?: string; amount?: number; node: ReactElement };
type Item = { type: "header"; key: string; label: string; total?: number } | { type: "row"; key: string; node: ReactElement };

function titleCase(value: unknown) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** Annual lists get a heading per month so a year of records stays scannable. */
function withMonthHeaders(rows: Row[], grouped: boolean): Item[] {
  if (!grouped) return rows.map((r) => ({ type: "row", key: r.key, node: r.node }));
  const items: Item[] = [];
  let current = "";
  let header: Extract<Item, { type: "header" }> | null = null;
  for (const row of rows) {
    const month = (row.date || "").slice(0, 7);
    if (month !== current) {
      current = month;
      const d = new Date(`${month}-01T00:00:00`);
      header = {
        type: "header",
        key: `h-${month}`,
        label: Number.isNaN(d.getTime()) ? "Undated" : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        total: 0,
      };
      items.push(header);
    }
    if (header && row.amount != null) header.total = (header.total || 0) + row.amount;
    items.push({ type: "row", key: row.key, node: row.node });
  }
  return items;
}

export default function ReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; mode?: string; year?: string; month?: string }>();
  const section = (params.section && params.section in TITLES ? params.section : "invoices") as ReportSection;
  const period = periodFromParams(params);
  const isMeasurements = section === "measurements";
  const q = useReportPeriod(period.mode, period.year, period.month);
  const measurements = useMeasurementReport(isMeasurements);
  const active = isMeasurements ? measurements : q;
  const [gstTab, setGstTab] = useState<"outward" | "inward">("outward");
  const invoiceDrawer = useInvoiceDrawer();
  const openInvoiceRef = useRef(invoiceDrawer.open);
  openInvoiceRef.current = invoiceDrawer.open;
  const openInvoice = useCallback((invoiceId: string) => openInvoiceRef.current(invoiceId), []);

  const content = useMemo(() => {
    if (isMeasurements) return measurementContent(measurements.data, router);
    return q.data ? sectionContent(section, q.data, router, gstTab, openInvoice) : null;
  }, [isMeasurements, measurements.data, q.data, section, router, gstTab, openInvoice]);

  const items = content ? withMonthHeaders(content.rows, period.mode === "year" && content.groupable) : [];

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} />}
          ListHeaderComponent={
            <View>
              <ScreenHeader
                title={TITLES[section]}
                subtitle={isMeasurements ? "All time" : section === "receivables" ? "As of today" : periodLabel(period)}
                onBack={() => router.back()}
              />
              {active.isLoading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
              {active.isError ? (
                <ErrorBanner
                  message={(active.error as { userMessage?: string })?.userMessage || "Couldn't load this report."}
                  onRetry={() => active.refetch()}
                />
              ) : null}
              {content?.header}
              {section === "gst" && q.data ? (
                <SegmentTabs
                  padded={false}
                  tabs={[
                    { key: "outward", label: `Sales (${q.data.gst.outwardRows.length})` },
                    { key: "inward", label: `Purchases (${q.data.gst.inwardRows.length})` },
                  ]}
                  value={gstTab}
                  onChange={setGstTab}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) =>
            item.type === "header" ? (
              <View style={styles.groupHead}>
                <Text style={styles.groupLabel}>{item.label}</Text>
                {item.total ? <Text style={styles.groupTotal}>{formatCurrency(String(item.total))}</Text> : null}
              </View>
            ) : (
              item.node
            )
          }
          ListEmptyComponent={content && !active.isLoading ? <EmptyState title={content.emptyTitle} subtitle={content.emptySubtitle} /> : null}
          ListFooterComponent={content?.footer}
        />
      </SafeAreaView>
      {invoiceDrawer.element}
    </SoftBackground>
  );
}

type Content = {
  header?: ReactElement;
  footer?: ReactElement;
  rows: Row[];
  groupable: boolean;
  emptyTitle: string;
  emptySubtitle?: string;
};

type Nav = ReturnType<typeof useRouter>;

function Summary({ items }: { items: { label: string; value: string; tone?: "positive" | "negative" }[] }) {
  return (
    <View style={styles.summary}>
      {items.map((s) => (
        <View key={s.label} style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{s.label}</Text>
          <Text style={[styles.summaryValue, s.tone === "positive" && { color: p.green }, s.tone === "negative" && { color: p.red }]}>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function sectionContent(section: ReportSection, r: PeriodReport, router: Nav, gstTab: "outward" | "inward", openInvoice: (id: string) => void): Content {
  const s = r.summary;
  switch (section) {
    case "invoices":
      return {
        header: <Summary items={[{ label: "Invoices", value: String(s.invoiceCount) }, { label: "Billed", value: formatCurrency(s.billed) }]} />,
        groupable: true,
        emptyTitle: "No invoices in this period",
        rows: r.invoices.map((inv) => {
          const due = Number(inv.outstanding);
          return {
            key: inv.id,
            date: inv.date,
            amount: Number(inv.total),
            node: (
              <ReportRow
                icon={FileText}
                seed={inv.id}
                title={inv.number || "Invoice"}
                subtitle={[inv.customerName, shortDate(inv.date)].filter(Boolean).join(" · ")}
                amount={formatCurrency(inv.total)}
                meta={inv.status === "draft" ? "Draft" : due > 0 ? `Due ${formatCurrency(inv.outstanding)}` : "Paid"}
                metaTone={inv.status === "draft" ? "muted" : due > 0 ? "warning" : "positive"}
                onPress={() => openInvoice(String(inv.id))}
              />
            ),
          };
        }),
      };
    case "payments":
      return {
        header: <Summary items={[{ label: "Payments", value: String(s.paymentCount) }, { label: "Collected", value: formatCurrency(s.collected), tone: "positive" }]} />,
        groupable: true,
        emptyTitle: "No payments in this period",
        rows: r.payments.map((pay) => ({
          key: pay.id,
          date: pay.date,
          amount: Number(pay.amount),
          node: (
            <ReportRow
              icon={Wallet}
              seed={pay.id}
              title={pay.customerName || "Payment"}
              subtitle={[pay.invoiceNumber, titleCase(pay.method), shortDate(pay.date)].filter(Boolean).join(" · ")}
              amount={formatCurrency(pay.amount)}
              amountTone="positive"
              onPress={() => router.push(`/(tabs)/payments/${pay.id}` as never)}
            />
          ),
        })),
      };
    case "expenses":
      return {
        header: (
          <Summary
            items={[
              { label: "Total", value: formatCurrency(s.expenses), tone: "negative" },
              { label: "Billable", value: formatCurrency(s.billableExpenses) },
              { label: "Internal", value: formatCurrency(s.internalExpenses) },
            ]}
          />
        ),
        groupable: true,
        emptyTitle: "No expenses in this period",
        rows: r.expenses.map((exp) => ({
          key: exp.id,
          date: exp.date,
          amount: Number(exp.amount),
          node: (
            <ReportRow
              icon={Receipt}
              seed={exp.category}
              title={expenseCategoryLabel(exp.category)}
              subtitle={[exp.description || exp.projectName, shortDate(exp.date)].filter(Boolean).join(" · ")}
              amount={formatCurrency(exp.amount)}
              meta={exp.billable ? "Billable" : undefined}
              metaTone="positive"
              onPress={() => router.push(`/(tabs)/expenses/${exp.id}` as never)}
            />
          ),
        })),
      };
    case "purchases":
      return {
        header: <Summary items={[{ label: "Purchases", value: String(s.purchaseCount) }, { label: "Total", value: formatCurrency(s.purchases), tone: "negative" }]} />,
        groupable: true,
        emptyTitle: "No purchases in this period",
        rows: r.purchases.map((pur) => ({
          key: pur.id,
          date: pur.date,
          amount: Number(pur.total),
          node: (
            <ReportRow
              icon={ShoppingCart}
              seed={pur.supplier || pur.id}
              title={pur.supplier || "Purchase"}
              subtitle={[pur.invoiceNumber, pur.projectName, shortDate(pur.date)].filter(Boolean).join(" · ")}
              amount={formatCurrency(pur.total)}
              meta={Number(pur.taxTotal) > 0 ? `GST ${formatCurrency(pur.taxTotal)}` : undefined}
            />
          ),
        })),
      };
    case "gst": {
      const rows = gstTab === "outward" ? r.gst.outwardRows : r.gst.inwardRows;
      const net = Number(s.netTax);
      return {
        header: (
          <View>
            <View style={styles.gstGrid}>
              <GstCard title="Output GST (sales)" totals={r.gst.outward} />
              <GstCard title="Input GST (purchases)" totals={r.gst.inward} />
            </View>
            <View style={[styles.netCard, { backgroundColor: net >= 0 ? p.claySoft : p.greenSoft }]}>
              <Text style={styles.netLabel}>{net >= 0 ? "Net GST payable" : "Net input credit"}</Text>
              <Text style={[styles.netValue, { color: net >= 0 ? p.clayDark : p.green }]}>{formatCurrency(String(Math.abs(net)))}</Text>
            </View>
          </View>
        ),
        groupable: true,
        emptyTitle: gstTab === "outward" ? "No GST sales in this period" : "No GST purchases in this period",
        emptySubtitle: gstTab === "outward" ? "Draft and void invoices are not included." : undefined,
        rows: rows.map((row) => ({
          key: `${gstTab}-${row.id}`,
          date: row.date,
          amount: Number(row.taxTotal),
          node: (
            <ReportRow
              title={row.party || (gstTab === "outward" ? "Customer" : "Supplier")}
              subtitle={[row.number, row.gstin || "Unregistered", shortDate(row.date)].filter(Boolean).join(" · ")}
              amount={formatCurrency(row.taxTotal)}
              meta={`Taxable ${formatCurrency(row.taxableAmount)}`}
              onPress={gstTab === "outward" ? () => openInvoice(String(row.id)) : undefined}
            />
          ),
        })),
      };
    }
    case "receivables":
      return {
        header: (
          <View>
            <Summary
              items={[
                { label: "Outstanding", value: formatCurrency(s.outstandingNow), tone: "negative" },
                { label: "Open invoices", value: String(s.openInvoiceCount) },
              ]}
            />
            {r.receivables.customers.length ? <Text style={styles.subhead}>By customer</Text> : null}
            {r.receivables.customers.map((c, i) => (
              <ReportRow
                key={c.customerId || `c-${i}`}
                icon={UserRound}
                seed={c.customerId || c.customerName}
                title={c.customerName}
                subtitle={`${c.invoiceCount} open invoice${c.invoiceCount === 1 ? "" : "s"}`}
                amount={formatCurrency(c.outstanding)}
                amountTone="negative"
                onPress={c.customerId ? () => router.push(`/(tabs)/customers/${c.customerId}` as never) : undefined}
              />
            ))}
            {r.receivables.invoices.length ? <Text style={styles.subhead}>Open invoices</Text> : null}
          </View>
        ),
        footer: r.receivables.invoices.length ? (
          <Pressable style={styles.primary} onPress={() => router.push("/(tabs)/payments/new" as never)}>
            <Text style={styles.primaryText}>Record a payment</Text>
          </Pressable>
        ) : undefined,
        groupable: false,
        emptyTitle: "Nothing outstanding",
        emptySubtitle: "Every sent invoice has been paid.",
        rows: r.receivables.invoices.map((inv) => ({
          key: inv.id,
          node: (
            <ReportRow
              icon={FileText}
              seed={inv.id}
              title={inv.number || "Invoice"}
              subtitle={[inv.customerName, inv.dueDate ? `Due ${shortDate(inv.dueDate)}` : null].filter(Boolean).join(" · ")}
              amount={formatCurrency(inv.outstanding)}
              amountTone="negative"
              meta={`of ${formatCurrency(inv.total)}`}
              onPress={() => openInvoice(String(inv.id))}
            />
          ),
        })),
      };
    case "ledger":
      return {
        header: <Summary items={[{ label: "Entries", value: String(r.ledger.length) }]} />,
        groupable: true,
        emptyTitle: "No ledger entries in this period",
        rows: r.ledger.map((e) => {
          const incoming = e.type === "payment";
          return {
            key: e.id,
            date: e.date,
            node: (
              <ReportRow
                icon={BookOpen}
                seed={e.type || e.id}
                title={titleCase(e.type) || "Entry"}
                subtitle={[e.notes || titleCase(e.reference), shortDate(e.date)].filter(Boolean).join(" · ")}
                amount={formatCurrency(e.amount)}
                amountTone={incoming ? "positive" : "default"}
              />
            ),
          };
        }),
      };
    default:
      return { rows: [], groupable: false, emptyTitle: "Nothing to show" };
  }
}

function measurementContent(data: Record<string, unknown> | undefined, router: Nav): Content | null {
  if (!data) return null;
  const sites = (data.items as Record<string, unknown>[]) || [];
  return {
    header: <Summary items={[{ label: "Measurements", value: String(data.total ?? 0) }, { label: "Sites", value: String(sites.length) }]} />,
    groupable: false,
    emptyTitle: "No measurements yet",
    rows: sites.map((site, i) => {
      const siteId = site.siteId ? String(site.siteId) : "";
      const count = Number(site.count || 0);
      return {
        key: siteId || `site-${i}`,
        node: (
          <ReportRow
            icon={MapPin}
            seed={siteId || "unassigned"}
            title={siteId ? String(site.siteName || "Site") : "Not linked to a site"}
            subtitle={`${count} measurement${count === 1 ? "" : "s"}`}
            onPress={siteId ? () => router.push(`/(tabs)/sites/${siteId}` as never) : undefined}
          />
        ),
      };
    }),
  };
}

function GstCard({ title, totals }: { title: string; totals: GstTotals }) {
  const lines = [
    { label: "Taxable value", value: totals.taxableAmount },
    { label: "CGST", value: totals.cgst },
    { label: "SGST", value: totals.sgst },
    { label: "IGST", value: totals.igst },
  ];
  return (
    <View style={styles.gstCard}>
      <Text style={styles.gstTitle}>{title}</Text>
      {lines.map((l) => (
        <View key={l.label} style={styles.gstLine}>
          <Text style={styles.gstLabel}>{l.label}</Text>
          <Text style={styles.gstValue}>{formatCurrency(l.value)}</Text>
        </View>
      ))}
      <View style={[styles.gstLine, styles.gstTotal]}>
        <Text style={styles.gstTotalLabel}>Total GST</Text>
        <Text style={styles.gstTotalValue}>{formatCurrency(totals.taxTotal)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  summary: {
    flexDirection: "row",
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 14,
    marginBottom: spacing.md,
    ...softShadow,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { color: p.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  summaryValue: { color: p.text, fontSize: 17, fontWeight: "800", marginTop: 4 },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 8, paddingHorizontal: 4 },
  groupLabel: { color: p.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  groupTotal: { color: p.text, fontSize: 13, fontWeight: "800" },
  subhead: { color: p.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4, marginBottom: 8 },
  gstGrid: { gap: 10 },
  gstCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    ...softShadow,
  },
  gstTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  gstLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  gstLabel: { color: p.muted, fontSize: 13, fontWeight: "600" },
  gstValue: { color: p.text, fontSize: 13, fontWeight: "700" },
  gstTotal: { borderTopWidth: 1, borderTopColor: p.border, marginTop: 6, paddingTop: 8 },
  gstTotalLabel: { color: p.text, fontSize: 14, fontWeight: "800" },
  gstTotalValue: { color: p.text, fontSize: 14, fontWeight: "800" },
  netCard: { borderRadius: radius.lg, padding: spacing.md, marginTop: 10, marginBottom: spacing.md, alignItems: "center" },
  netLabel: { color: p.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  netValue: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  primary: { marginTop: spacing.sm, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 15, alignItems: "center", ...softShadow },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
