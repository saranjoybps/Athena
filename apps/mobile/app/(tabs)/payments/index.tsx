import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Wallet } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { rowStyles } from "@/components/attendance/AttendanceUi";
import { usePayments, usePrefetchDetail } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { methodMeta } from "@/lib/payments";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

export default function PaymentsScreen() {
  const router = useRouter();
  const q = usePayments();
  const prefetch = usePrefetchDetail();
  const items = q.data?.items ?? [];

  const month = useMemo(() => {
    const now = new Date();
    const rows = items.filter((row) => {
      const d = new Date(String(row.createdAt || ""));
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return {
      label: now.toLocaleDateString("en-GB", { month: "long" }),
      total: rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      count: rows.length,
    };
  }, [items]);

  return (
    <ModuleListScreen
      title="Payments"
      subtitle="Money received from customers"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage || "Couldn't load payments." : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/payments/new" as never)}
      emptyTitle="No payments yet"
      emptySubtitle="Record a payment against an invoice when a customer pays."
      headerExtra={
        items.length > 0 ? (
          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <Wallet size={20} color={p.green} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Received in {month.label}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(month.total)}</Text>
            </View>
            <Text style={styles.summaryCount}>
              {month.count} payment{month.count === 1 ? "" : "s"}
            </Text>
          </View>
        ) : null
      }
      renderItem={(item) => (
        <PaymentRow
          payment={item}
          onPress={() => {
            prefetch("payments", item.id);
            router.push(`/(tabs)/payments/${item.id}` as never);
          }}
        />
      )}
    />
  );
}

function PaymentRow({ payment, onPress }: { payment: AthenaRecord; onPress: () => void }) {
  const customer = String(payment.customerName || "Customer");
  const context = [payment.projectName, payment.invoiceNumber].filter(Boolean).map(String).join(" · ");
  return (
    <Pressable style={rowStyles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${customer} payment`}>
      <Avatar name={customer} seed={String(payment.customerId || payment.id)} />
      <View style={rowStyles.body}>
        <Text style={rowStyles.title} numberOfLines={1}>
          {customer}
        </Text>
        {context ? (
          <Text style={rowStyles.subtitle} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatCurrency(String(payment.amount || 0))}</Text>
        <Text style={styles.meta}>
          {formatDate(String(payment.createdAt || ""))} · {methodMeta(payment.method).label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: 4,
    ...softShadow,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: p.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: { color: p.muted, fontSize: 12, fontWeight: "700" },
  summaryValue: { color: p.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  summaryCount: { color: p.muted, fontSize: 13, fontWeight: "600" },
  right: { alignItems: "flex-end", maxWidth: "42%" },
  amount: { color: p.green, fontSize: 16, fontWeight: "800" },
  meta: { color: p.faint, fontSize: 12, marginTop: 2, fontWeight: "600" },
});
