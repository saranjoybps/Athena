import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import apiClient from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";
import type { AthenaRecord, Paginated } from "@/types";

export default function ReportsScreen() {
  const router = useRouter();
  const accounts = useAccounts();
  const attendance = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/attendance");
      return data;
    },
  });

  const pl = ((accounts.data?.pl || accounts.data || {}) as Record<string, unknown>) || {};
  const rows = attendance.data?.items || [];
  const present = rows.filter((a) => ["present", "half_day"].includes(String(a.status))).length;
  const absent = rows.filter((a) => String(a.status) === "absent").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader title="Reports" subtitle="Accounts & attendance" onBack={() => router.back()} />
      {accounts.isError ? (
        <ErrorBanner
          message={(accounts.error as { userMessage?: string })?.userMessage || "Failed"}
          onRetry={() => accounts.refetch()}
        />
      ) : null}
      {accounts.isLoading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Accounts</Text>
        <View style={styles.grid}>
          <Stat label="Collected" value={formatCurrency(String(pl.collections ?? 0))} />
          <Stat label="Outstanding" value={formatCurrency(String(pl.outstanding ?? 0))} />
          <Stat label="Costs" value={formatCurrency(String(pl.costs ?? 0))} />
          <Stat label="Net" value={formatCurrency(String(pl.net ?? 0))} />
        </View>
        <Text style={styles.section}>Attendance</Text>
        <View style={styles.grid}>
          <Stat label="Records" value={String(rows.length)} />
          <Stat label="Present / half" value={String(present)} />
          <Stat label="Absent" value={String(absent)} />
        </View>
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
  content: { padding: spacing.lg, gap: 8, paddingBottom: tabBarClearance },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  statLabel: { color: p.muted, fontSize: 12, fontWeight: "600" },
  statValue: { color: p.text, fontSize: 18, fontWeight: "800", marginTop: 4 },
});
