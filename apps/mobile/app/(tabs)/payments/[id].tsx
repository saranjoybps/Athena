import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePayments } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = usePayments();
  const payment = (data?.items || []).find((pmt) => String(pmt.id) === String(id));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Payment" subtitle={payment ? String(payment.number || "") : undefined} onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {!isLoading && !payment ? <Text style={styles.muted}>Payment not found.</Text> : null}
        {payment ? (
          <View style={styles.card}>
            <Row label="Amount" value={formatCurrency(String(payment.amount || 0))} />
            <Row label="Method" value={String(payment.method || "—").toUpperCase()} />
            <Row label="Reference" value={String(payment.reference || "—")} />
            <Row label="Invoice" value={String(payment.invoiceId || "—").slice(0, 12)} />
            <Row label="Date" value={formatDate(payment.createdAt)} />
            {payment.notes ? <Row label="Notes" value={String(payment.notes)} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  rowLabel: { color: p.muted },
  value: { ...typography.h3, color: p.text, flexShrink: 1, textAlign: "right" },
  muted: { color: p.muted },
});
