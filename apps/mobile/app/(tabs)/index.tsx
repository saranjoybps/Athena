import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useDashboard } from "@/hooks/useApi";
import { useAuthStore } from "@/store";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p, spacing, typography } from "@/lib/theme";

const FIELD_ACTIONS = [
  { label: "Log expense", href: "/(tabs)/expenses/new" },
  { label: "Mark attendance", href: "/(tabs)/attendance" },
  { label: "Log snag", href: "/(tabs)/snags/new" },
  { label: "Open Field hub", href: "/(tabs)/field" },
];

const OFFICE_ACTIONS = [
  { label: "Customers / CRM", href: "/(tabs)/customers" },
  { label: "Sites (survey & measure)", href: "/(tabs)/sites" },
  { label: "Record payment", href: "/(tabs)/payments/new" },
  { label: "New estimate", href: "/(tabs)/estimates/new" },
  { label: "Accounts", href: "/(tabs)/more/accounts" },
];

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch, isRefetching } = useDashboard();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ConnectionBanner />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={p.clay} />}
      >
        <Text style={styles.hello}>Hello{user?.businessName ? "," : ""}</Text>
        <Text style={styles.biz}>{user?.businessName || "Athena"}</Text>
        <Text style={styles.sub}>Field-first · pull to refresh</Text>

        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed to load"} onRetry={() => refetch()} />
        ) : null}
        {isLoading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 24 }} /> : null}

        <View style={styles.grid}>
          <StatCard label="Collections" value={formatCurrency(String(data?.collections ?? 0))} />
          <StatCard label="Outstanding" value={formatCurrency(String(data?.outstanding ?? 0))} tint={p.amberSoft} color={p.amber} />
          <StatCard label="Pending quotes" value={String(data?.pendingQuotations ?? 0)} tint={p.blueSoft} color={p.blue} />
          <StatCard label="Active projects" value={String(data?.activeProjects ?? 0)} tint={p.greenSoft} color={p.green} />
        </View>

        <Text style={styles.section}>On site</Text>
        {FIELD_ACTIONS.map((item) => (
          <Pressable key={item.href + item.label} style={styles.action} onPress={() => router.push(item.href as never)}>
            <Text style={styles.actionText}>{item.label}</Text>
            <Text style={styles.chev}>→</Text>
          </Pressable>
        ))}

        <Text style={[styles.section, { marginTop: spacing.lg }]}>Office / CRM</Text>
        {OFFICE_ACTIONS.map((item) => (
          <Pressable key={item.href + item.label} style={styles.action} onPress={() => router.push(item.href as never)}>
            <Text style={styles.actionText}>{item.label}</Text>
            <Text style={styles.chev}>→</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  hello: { color: p.muted, fontSize: 14 },
  biz: { ...typography.h1, color: p.text, marginTop: 2 },
  sub: { color: p.muted, marginTop: 4, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: spacing.lg },
  section: { ...typography.h3, color: p.text, marginBottom: spacing.sm },
  action: {
    backgroundColor: p.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: p.border,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    alignItems: "center",
  },
  actionText: { color: p.text, fontWeight: "600", fontSize: 16 },
  chev: { color: p.clay, fontWeight: "700" },
});
