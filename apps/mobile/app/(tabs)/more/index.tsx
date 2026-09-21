import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  HardHat,
  Image as ImageIcon,
  Package,
  Receipt,
  Settings2,
  Users,
  Wallet,
  Wrench,
  BarChart3,
  Truck,
} from "lucide-react-native";
import { signOut } from "@/lib/auth";
import { useAuthStore } from "@/store";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { cardShadow, lightPalette as p, radius, spacing, typography, tabBarClearance } from "@/lib/theme";

type LinkItem = { label: string; href: string; hint?: string; icon: typeof BookOpen };
type LinkGroup = { title: string; items: LinkItem[] };

const GROUPS: LinkGroup[] = [
  {
    title: "Home",
    items: [
      { label: "Dashboard", href: "/(tabs)/", hint: "Overview & follow-ups", icon: BarChart3 },
    ],
  },
  {
    title: "Accounts",
    items: [
      { label: "Accounts", href: "/(tabs)/more/accounts", hint: "P&L, receivables, ledger", icon: BookOpen },
      { label: "Payments", href: "/(tabs)/payments", hint: "Collections & receipts", icon: Wallet },
    ],
  },
  {
    title: "Field",
    items: [
      { label: "Attendance", href: "/(tabs)/attendance", hint: "Mark present / half day", icon: ClipboardList },
      // Snags UI hidden for now — screens/API kept for later re-enable.
      // { label: "Snags", href: "/(tabs)/snags", hint: "Defects & punch list", icon: AlertTriangle },
      { label: "Schedule", href: "/(tabs)/more/schedule", hint: "Crew & project calendar", icon: CalendarDays },
      { label: "Field tools", href: "/(tabs)/field", hint: "Quick site actions", icon: Wrench },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Materials", href: "/(tabs)/materials", hint: "HSN, GST, rates", icon: Package },
      { label: "Stock", href: "/(tabs)/more/stock", hint: "On-hand quantities", icon: Package },
      { label: "Labour", href: "/(tabs)/labour", hint: "Workers and day rates", icon: HardHat },
      { label: "Crews", href: "/(tabs)/more/crews", hint: "Site crews & daily wages", icon: Users },
      { label: "Tools", href: "/(tabs)/more/tools", hint: "Site tools and equipment", icon: Wrench },
    ],
  },
  {
    title: "Documents",
    items: [
      { label: "Estimates", href: "/(tabs)/quotes", hint: "Send & follow up", icon: FileText },
      { label: "Invoices", href: "/(tabs)/invoices", hint: "Billable documents", icon: Receipt },
      { label: "Delivery challans", href: "/(tabs)/delivery-challans", hint: "Outbound DC", icon: Truck },
      { label: "Expenses", href: "/(tabs)/expenses", hint: "Site & job spend", icon: Wallet },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Photos", href: "/(tabs)/more/photos", hint: "Site progress photos", icon: ImageIcon },
      { label: "Documents", href: "/(tabs)/more/documents", hint: "Invoices & site uploads", icon: FileText },
      { label: "Users", href: "/(tabs)/more/users", hint: "Access: admin, home, accounts, inventory, field", icon: Users },
      { label: "Reports", href: "/(tabs)/more/reports", hint: "GST · stock · daily expenses", icon: BarChart3 },
      { label: "API & device", href: "/(tabs)/more/settings", hint: "Server URL for APK installs", icon: Settings2 },
    ],
  },
];

export default function SettingsHubScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="More" subtitle="All modules" />

        <View style={styles.card}>
          <Text style={styles.name}>{user?.businessName || "Athena"}</Text>
          <Text style={styles.meta}>{user?.email || user?.userId}</Text>
          <Text style={styles.meta}>
            Access:{" "}
            {Array.isArray(user?.roles) && user.roles.length
              ? user.roles.map((r) => String(r).replace(/_/g, " ")).join(", ")
              : "—"}
          </Text>
        </View>

        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((l) => {
              const Icon = l.icon;
              return (
                <Pressable key={l.href} style={styles.link} onPress={() => router.push(l.href as never)}>
                  <View style={styles.iconWrap}>
                    <Icon size={18} color={p.clay} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkText}>{l.label}</Text>
                    {l.hint ? <Text style={styles.hint}>{l.hint}</Text> : null}
                  </View>
                  <ChevronRight size={18} color={p.faint} />
                </Pressable>
              );
            })}
          </View>
        ))}

        <Pressable
          style={styles.signOut}
          onPress={() => {
            signOut();
            router.replace("/(auth)/login");
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  name: { ...typography.h3, color: p.text, fontWeight: "700" },
  meta: { color: p.muted, marginTop: 4 },
  group: { marginBottom: spacing.md },
  groupTitle: {
    color: p.faint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  link: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: p.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...cardShadow,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { color: p.text, fontWeight: "700", fontSize: 15 },
  hint: { color: p.muted, fontSize: 12, marginTop: 2 },
  signOut: { marginTop: spacing.sm, padding: spacing.md, alignItems: "center" },
  signOutText: { color: p.red, fontWeight: "700" },
});
