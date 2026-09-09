import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAccounts } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function AccountsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useAccounts();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={p.clay} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Accounts" onBack={() => router.back()} />
        <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  const pl = (data.pl || {}) as Record<string, string>;
  const receivables = (data.receivables as Record<string, unknown>[]) || [];
  const ledger = (data.ledger as Record<string, unknown>[]) || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader title="Accounts" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stats}>
          <Stat label="Collected" value={formatCurrency(pl.collections)} />
          <Stat label="Outstanding" value={formatCurrency(pl.outstanding)} />
        </View>
        <View style={styles.stats}>
          <Stat label="Costs" value={formatCurrency(pl.costs)} />
          <Stat label="Net" value={formatCurrency(pl.net)} />
        </View>

        <Text style={styles.section}>Receivables</Text>
        {receivables.length === 0 ? <EmptyState title="No open invoices" /> : null}
        {receivables.map((r) => (
          <RecordCard
            key={String(r.invoiceId)}
            title={String(r.number || r.invoiceId)}
            subtitle={`${String(r.customerName || "Customer")} · ${formatCurrency(String(r.outstanding))}`}
            onPress={() => router.push(`/(tabs)/invoices/${r.invoiceId}` as never)}
          />
        ))}

        <Pressable style={styles.link} onPress={() => router.push("/(tabs)/payments/new" as never)}>
          <Text style={styles.linkText}>Record payment →</Text>
        </Pressable>

        <Text style={styles.section}>Ledger</Text>
        {ledger.length === 0 ? <EmptyState title="No ledger entries" /> : null}
        {ledger.slice(0, 20).map((e) => (
          <View key={String(e.id)} style={styles.entry}>
            <Text style={styles.entryTitle}>
              {String(e.type)} · {formatCurrency(String(e.amount))}
            </Text>
            <Text style={styles.entryMeta}>
              {String(e.notes || e.reference || "")} · {formatDate(String(e.postedAt || ""))}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  stats: { flexDirection: "row", gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border },
  statLabel: { color: p.muted, fontSize: 11, textTransform: "uppercase" },
  statValue: { color: p.text, fontWeight: "700", marginTop: 4, fontSize: 15 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: 8 },
  link: { paddingVertical: 10 },
  linkText: { color: p.clay, fontWeight: "700" },
  entry: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 8,
  },
  entryTitle: { color: p.text, fontWeight: "600" },
  entryMeta: { color: p.muted, fontSize: 12, marginTop: 4 },
});
