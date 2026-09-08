import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
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
  Wallet,
  Users,
  FolderKanban,
  Plus,
  ChevronRight,
  CircleUserRound,
  Banknote,
} from "lucide-react-native";
import { useDashboard, usePayments } from "@/hooks/useApi";
import { useAuthStore } from "@/store";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { formatCurrency, formatDate } from "@/lib/format";
import { cardShadow, lightPalette as p, spacing, typography, radius } from "@/lib/theme";

const HERO = require("../../assets/images/home-hero.png");

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch, isRefetching } = useDashboard();
  const payments = usePayments();

  const recentPayments = (payments.data?.items || []).slice(0, 4);
  const firstName = String(user?.businessName || "Athena").split(" ")[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              payments.refetch();
            }}
            tintColor={p.clay}
          />
        }
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Good day</Text>
            <Text style={styles.biz} numberOfLines={1}>
              {user?.businessName || "Athena"}
            </Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/(tabs)/more" as never)} hitSlop={8}>
            <CircleUserRound size={22} color={p.text} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.heroImageWrap}>
          <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroImageScrim} />
          <Text style={styles.heroImageTitle}>Built for site & office</Text>
          <Text style={styles.heroImageSub}>Customers · estimates · projects · collections</Text>
        </View>

        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed to load"} onRetry={() => refetch()} />
        ) : null}
        {isLoading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 24 }} /> : null}

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Wallet size={18} color={p.clay} strokeWidth={2.4} />
            </View>
            <Text style={styles.heroEyebrow}>Collections</Text>
          </View>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Outstanding</Text>
              <Text style={styles.heroBig}>{formatCurrency(String(data?.outstanding ?? 0))}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Collected</Text>
              <Text style={styles.heroSide}>{formatCurrency(String(data?.collections ?? 0))}</Text>
            </View>
          </View>
        </View>

        <View style={styles.pulseRow}>
          <Pressable style={styles.pulseCard} onPress={() => router.push("/(tabs)/projects" as never)}>
            <Text style={styles.pulseValue}>{String(data?.activeProjects ?? 0)}</Text>
            <Text style={styles.pulseLabel}>Active projects</Text>
          </Pressable>
          <Pressable style={styles.pulseCard} onPress={() => router.push("/(tabs)/customers" as never)}>
            <Text style={styles.pulseValue}>{String(data?.pendingQuotations ?? 0)}</Text>
            <Text style={styles.pulseLabel}>Pending estimates</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Start work</Text>
        <View style={styles.actionGrid}>
          <ActionTile
            icon={<Plus size={20} color={p.clay} strokeWidth={2.4} />}
            title="New customer"
            onPress={() => router.push("/(tabs)/customers/new" as never)}
          />
          <ActionTile
            icon={<Users size={20} color={p.clay} strokeWidth={2.4} />}
            title="Customers"
            onPress={() => router.push("/(tabs)/customers" as never)}
          />
          <ActionTile
            icon={<FolderKanban size={20} color={p.clay} strokeWidth={2.4} />}
            title="Projects"
            onPress={() => router.push("/(tabs)/projects" as never)}
          />
          <ActionTile
            icon={<Banknote size={20} color={p.clay} strokeWidth={2.4} />}
            title="Payments"
            onPress={() => router.push("/(tabs)/payments" as never)}
          />
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
              <RecordCard
                key={String(pay.id)}
                title={formatCurrency(String(pay.amount || 0))}
                subtitle={`${String(pay.method || "payment")} · ${formatDate(pay.createdAt)}`}
                onPress={() => router.push(`/(tabs)/payments/${pay.id}` as never)}
              />
            ))}
          </>
        ) : null}

        <Text style={styles.footerHint}>Hi {firstName} — pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  title,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]} onPress={onPress}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileTitle}>{title}</Text>
      <ChevronRight size={16} color={p.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 110 },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  hello: { color: p.muted, fontSize: 13, fontWeight: "600" },
  biz: { ...typography.h1, color: p.text, marginTop: 2, fontSize: 24 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  heroImageWrap: {
    height: 168,
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: spacing.md,
    backgroundColor: p.claySoft,
    ...cardShadow,
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  heroImageTitle: {
    position: "absolute",
    left: 16,
    bottom: 34,
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroImageSub: {
    position: "absolute",
    left: 16,
    bottom: 14,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  hero: {
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: { color: p.muted, fontWeight: "700", fontSize: 13 },
  heroRow: { flexDirection: "row", alignItems: "flex-end" },
  heroDivider: { width: 1, height: 44, backgroundColor: p.border, marginHorizontal: 14 },
  heroLabel: { color: p.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  heroBig: { color: p.clayDark, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  heroSide: { color: p.text, fontSize: 22, fontWeight: "700" },
  pulseRow: { flexDirection: "row", gap: 10, marginBottom: spacing.lg },
  pulseCard: {
    flex: 1,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
  },
  pulseValue: { color: p.text, fontSize: 26, fontWeight: "800" },
  pulseLabel: { color: p.muted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  section: { ...typography.h3, color: p.text, fontWeight: "700", marginBottom: 10 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  link: { color: p.clay, fontWeight: "700", fontSize: 13 },
  actionGrid: { gap: 8, marginBottom: spacing.lg },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: p.border,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { flex: 1, color: p.text, fontWeight: "600", fontSize: 15 },
  footerHint: { textAlign: "center", color: p.faint, fontSize: 12, marginTop: spacing.md },
});
