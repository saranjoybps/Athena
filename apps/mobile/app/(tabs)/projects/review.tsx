import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useBillingReview, useCreateInvoice } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Line = Record<string, unknown>;

export default function BillingReview() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const id = String(projectId || "");
  const router = useRouter();
  const reviewQ = useBillingReview(id);
  const create = useCreateInvoice();
  const [sent, setSent] = useState(false);
  const review = reviewQ.data;
  const summary = (review?.summary || {}) as Record<string, string>;
  const lines = (review?.suggestedLines as Line[] | undefined) || [];

  async function createInvoice() {
    if (!lines.length || sent) return;
    setSent(true);
    try {
      const invoice = await create.mutateAsync({
        key: `final-${id}-${Date.now()}`,
        body: {
          projectId: id,
          kind: "final",
          items: lines,
          taxRate: "0",
        },
      });
      Toast.show({ type: "success", text1: "Final invoice created", text2: String(invoice.number || "") });
      router.replace(`/(tabs)/invoices/${invoice.id}` as never);
    } catch (e) {
      setSent(false);
      Toast.show({ type: "error", text1: "Couldn't create the invoice", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    }
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Final billing review" subtitle="Estimate, actual cost, and what can be billed" onBack={() => router.back()} />
          {reviewQ.isLoading ? <ActivityIndicator color={p.clay} /> : null}
          {reviewQ.isError ? <ErrorBanner message="Couldn't load the billing review." onRetry={() => reviewQ.refetch()} /> : null}
          {review ? (
            <>
              <View style={styles.card}>
                <Row label="Original estimate" value={formatCurrency(summary.originalEstimate)} />
                <Row label="Approved variations" value={formatCurrency(summary.approvedVariations)} />
                <Row label="Agreed project value" value={formatCurrency(summary.agreedProjectValue)} />
                <Row label="Invoiced" value={formatCurrency(summary.invoiced)} />
                <Row label="Collected" value={formatCurrency(summary.collected)} />
                <Row label="Balance due" value={formatCurrency(summary.balanceDue)} />
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Labour margin</Text>
                <Row label="Labour revenue" value={formatCurrency(summary.labourRevenue)} />
                <Row label="Actual wages" value={formatCurrency(summary.actualLabourCost)} />
                <Row label="Labour margin" value={formatCurrency(summary.labourMargin)} />
                <Text style={styles.note}>Labour margin is not the project profit.</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Project result</Text>
                <Row label="Materials cost" value={formatCurrency(summary.actualMaterialCost)} />
                <Row label="Tools cost" value={formatCurrency(summary.actualToolCost)} />
                <Row label="Other costs" value={formatCurrency(summary.actualOtherCost)} />
                <Row label="Accounting profit" value={formatCurrency(summary.accountingProfit)} />
                <Text style={styles.note}>{summary.accountingBasis}</Text>
                <Row label="Cash result" value={formatCurrency(summary.cashResult)} />
                <Text style={styles.note}>{summary.cashBasis}</Text>
              </View>
              <Text style={styles.cardTitle}>Still to bill</Text>
              <Text style={styles.note}>{String(review.note || "")}</Text>
              {lines.length === 0 ? <Text style={styles.note}>Nothing new to invoice. Completed work and billable costs are already on an invoice, or no billable work has been logged.</Text> : null}
              {lines.map((line, index) => (
                <View key={`${line.sourceLineId || line.expenseId || line.changeOrderId || index}`} style={styles.line}>
                  <Text style={styles.lineTitle}>{String(line.description || "Charge")}</Text>
                  <Text style={styles.note}>
                    {String(line.quantity || "")} {String(line.unit || "")} × {formatCurrency(String(line.rate || 0))}
                  </Text>
                  <Text style={styles.lineAmount}>{formatCurrency(String(line.amount || 0))}</Text>
                </View>
              ))}
              <PrimaryButton label={create.isPending ? "Creating invoice…" : "Create final invoice"} onPress={createInvoice} disabled={!lines.length || create.isPending} />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance, gap: 10 },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: spacing.md, gap: 6 },
  cardTitle: { color: p.text, fontWeight: "800", fontSize: 16 },
  note: { color: p.muted, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: p.muted, fontSize: 13, flex: 1 },
  rowValue: { color: p.text, fontWeight: "800", fontSize: 13 },
  line: { backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: spacing.md },
  lineTitle: { color: p.text, fontWeight: "700" },
  lineAmount: { color: p.text, fontWeight: "800", marginTop: 4 },
});
