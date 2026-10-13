import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Users,
  FolderKanban,
  Package,
  ClipboardList,
  BookOpen,
  UserRound,
} from "lucide-react-native";
import { useDashboard, usePayments, useProjects } from "@/hooks/useApi";
import { useAuthStore } from "@/store";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatCurrency, formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { cardShadow, lightPalette as p, spacing, typography, radius, tabBarClearance, softShadow } from "@/lib/theme";

const QUICK = [
  { title: "Customers", subtitle: "Sites & estimates", href: "/(tabs)/customers", icon: Users, tint: p.sky, color: p.blue },
  { title: "Projects", subtitle: "Jobs & money", href: "/(tabs)/projects", icon: FolderKanban, tint: p.peach, color: p.clay },
  { title: "Attendance", subtitle: "Mark labour days", href: "/(tabs)/attendance", icon: ClipboardList, tint: p.mint, color: p.green },
  { title: "Materials", subtitle: "Catalog rates", href: "/(tabs)/materials", icon: Package, tint: p.butter, color: p.amber },
  { title: "People", subtitle: "Workers & crews", href: "/(tabs)/labour", icon: UserRound, tint: p.lilac, color: p.purple },
  { title: "Accounts", subtitle: "P&L & ledger", href: "/(tabs)/more/accounts", icon: BookOpen, tint: p.claySoft, color: p.clayDark },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // Skip requests the API would reject with 403 for this role.
  const canViewReports = hasPermission(user, "report.view");
  const canViewPayments = hasPermission(user, "payment.view");
  const canViewProjects = hasPermission(user, "project.read");
  const { data, isLoading, isError, error, refetch, isRefetching } = useDashboard(canViewReports);
  const payments = usePayments(canViewPayments);
  const projectsQ = useProjects(canViewProjects);

  const recentPayments = (payments.data?.items || []).slice(0, 4);
  const activeProjects = (projectsQ.data?.items || [])
    .filter((pr) => !["completed", "cancelled"].includes(String(pr.status || "")))
    .slice(0, 6);

  const firstName = String(user?.businessName || user?.email || "there")
    .split(/\s+|@/)[0];
  const initials = String(user?.businessName || user?.email || "A")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const outstanding = Number(data?.outstanding ?? 0) || 0;
  const collected = Number(data?.collections ?? 0) || 0;
  const billed = outstanding + collected;
  const collectionPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                if (canViewReports) refetch();
                if (canViewPayments) payments.refetch();
                if (canViewProjects) projectsQ.refetch();
              }}
              tintColor={p.clay}
            />
          }
        >
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.hello}>Hello!</Text>
              <Text style={styles.name} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
            <Pressable style={styles.profileBtn} onPress={() => router.push("/(tabs)/more" as never)}>
              <Text style={styles.profileBtnText}>{initials || "A"}</Text>
            </Pressable>
          </View>

          {isError ? (
            <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed to load"} onRetry={() => refetch()} />
          ) : null}
          {canViewReports ? (
            <View style={styles.heroCard}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.heroTitle}>
                  {isLoading
                    ? "Loading collections…"
                    : billed > 0
                      ? outstanding > 0
                        ? "Outstanding collections"
                        : "All billed amounts collected"
                      : "No billing yet"}
                </Text>
                <Text style={styles.heroSub}>
                  {isLoading
                    ? "Fetching received and due amounts"
                    : `${formatCurrency(String(collected))} received · ${formatCurrency(String(outstanding))} due`}
                </Text>
                <Pressable style={styles.heroBtn} onPress={() => router.push("/(tabs)/payments" as never)}>
                  <Text style={styles.heroBtnText}>View payments</Text>
                </Pressable>
              </View>
              {billed > 0 ? (
                <ProgressRing progress={collectionPct} size={84} stroke={8} color="#fff" trackColor="rgba(255,255,255,0.28)" />
              ) : null}
            </View>
          ) : null}

          {canViewProjects ? (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>In progress</Text>
                <Pressable onPress={() => router.push("/(tabs)/projects" as never)}>
                  <Text style={styles.link}>See all</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {activeProjects.length === 0 ? (
                  <View style={[styles.progressCard, { backgroundColor: p.peach }]}>
                    <Text style={styles.progressEyebrow}>Projects</Text>
                    <Text style={styles.progressTitle}>{projectsQ.isLoading ? "Loading jobs…" : "No active jobs"}</Text>
                    <Text style={styles.progressMeta}>
                      {projectsQ.isLoading ? "Fetching active projects" : "Approve an estimate to start"}
                    </Text>
                  </View>
                ) : (
                  activeProjects.map((pr, idx) => {
                    const tints = [p.peach, p.mint, p.butter, p.sky, p.lilac];
                    return (
                      <Pressable
                        key={String(pr.id)}
                        style={[styles.progressCard, { backgroundColor: tints[idx % tints.length] }]}
                        onPress={() => router.push(`/(tabs)/projects/${pr.id}` as never)}
                      >
                        <Text style={styles.progressEyebrow}>{String(pr.status || "active")}</Text>
                        <Text style={styles.progressTitle} numberOfLines={2}>
                          {String(pr.name || pr.number || "Project")}
                        </Text>
                        {pr.number ? <Text style={styles.progressMeta}>{String(pr.number)}</Text> : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.section}>Quick access</Text>
          <View style={styles.quickGrid}>
            {QUICK.map((g) => {
              const Icon = g.icon;
              return (
                <Pressable key={g.title} style={styles.quickCard} onPress={() => router.push(g.href as never)}>
                  <View style={[styles.quickIcon, { backgroundColor: g.tint }]}>
                    <Icon size={22} color={g.color} strokeWidth={2.3} />
                  </View>
                  <Text style={styles.quickTitle}>{g.title}</Text>
                  <Text style={styles.quickSub}>{g.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>

          {recentPayments.length > 0 ? (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Recent payments</Text>
                <Pressable onPress={() => router.push("/(tabs)/payments" as never)}>
                  <Text style={styles.link}>See all</Text>
                </Pressable>
              </View>
              {recentPayments.map((pay) => (
                <Pressable
                  key={String(pay.id)}
                  style={styles.payCard}
                  onPress={() => router.push(`/(tabs)/payments/${pay.id}` as never)}
                >
                  <View>
                    <Text style={styles.payTitle}>{formatCurrency(String(pay.amount || 0))}</Text>
                    <Text style={styles.paySub}>
                      {String(pay.method || "payment")} · {formatDate(pay.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.payBadge}>
                    <Text style={styles.payBadgeText}>Received</Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.lg },
  profileBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFEDD5",
  },
  profileBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  hello: { color: p.muted, fontSize: 13, fontWeight: "600" },
  name: { ...typography.h2, color: p.text, marginTop: 1 },
  heroCard: {
    backgroundColor: p.clay,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 26, marginBottom: 6 },
  heroSub: { color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "600", marginBottom: 14 },
  heroBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroBtnText: { color: p.clayDark, fontWeight: "800", fontSize: 12 },
  section: { ...typography.h3, color: p.text, marginBottom: 12 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  link: { color: p.clay, fontWeight: "700", fontSize: 13 },
  hScroll: { gap: 12, paddingBottom: spacing.md, paddingRight: 8 },
  progressCard: {
    width: 168,
    borderRadius: radius.lg,
    padding: 14,
    ...softShadow,
  },
  progressEyebrow: { color: p.muted, fontSize: 11, fontWeight: "700", textTransform: "capitalize", marginBottom: 6 },
  progressTitle: { color: p.text, fontWeight: "800", fontSize: 15, minHeight: 40 },
  progressMeta: { color: p.muted, fontSize: 12, marginTop: 8 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing.lg,
  },
  quickCard: {
    width: "47.5%",
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: p.border,
    ...softShadow,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quickTitle: { color: p.text, fontWeight: "800", fontSize: 15 },
  quickSub: { color: p.muted, fontSize: 12, marginTop: 2 },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 10,
    ...softShadow,
  },
  payTitle: { color: p.text, fontWeight: "800", fontSize: 16 },
  paySub: { color: p.muted, fontSize: 12, marginTop: 3 },
  payBadge: { backgroundColor: p.greenSoft, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  payBadgeText: { color: p.green, fontWeight: "700", fontSize: 11 },
});
