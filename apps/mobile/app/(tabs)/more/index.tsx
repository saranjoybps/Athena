import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  HardHat,
  Package,
  Wallet,
  Wrench,
  BarChart3,
} from "lucide-react-native";
import { signOut } from "@/lib/auth";
import { useAuthStore } from "@/store";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { softShadow, lightPalette as p, radius, spacing, typography, tabBarClearance } from "@/lib/theme";

type LinkItem = { label: string; href: string; hint?: string; icon: typeof BookOpen; tint: string; color: string };
type LinkGroup = { title: string; items: LinkItem[] };

const GROUPS: LinkGroup[] = [
  {
    title: "Accounts",
    items: [
      { label: "Accounts", href: "/(tabs)/more/accounts", hint: "P&L, receivables, ledger", icon: BookOpen, tint: p.mint, color: p.green },
      { label: "Payments", href: "/(tabs)/payments", hint: "Collections & receipts", icon: Wallet, tint: p.butter, color: p.amber },
      { label: "Reports", href: "/(tabs)/more/reports", hint: "GST · P&L", icon: BarChart3, tint: p.claySoft, color: p.clayDark },
    ],
  },
  {
    title: "Field",
    items: [
      { label: "Attendance", href: "/(tabs)/attendance", hint: "Mark labour by project & date", icon: ClipboardList, tint: p.sky, color: p.blue },
      { label: "Tools", href: "/(tabs)/more/tools", hint: "Site tools & equipment", icon: Wrench, tint: p.peach, color: p.clay },
    ],
  },
  {
    title: "People & materials",
    items: [
      { label: "Materials", href: "/(tabs)/materials", hint: "HSN, GST, rates", icon: Package, tint: p.butter, color: p.amber },
      {
        label: "People",
        href: "/(tabs)/labour",
        hint: "Workers + crews (link labour on create/edit crew)",
        icon: HardHat,
        tint: p.peach,
        color: p.clay,
      },
    ],
  },
];

export default function SettingsHubScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initials = String(user?.businessName || user?.email || "A")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="More" subtitle="Modules & profile" onBack={() => router.replace("/(tabs)/" as never)} />

          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "A"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.businessName || "Athena"}</Text>
              <Text style={styles.profileEmail}>{user?.email || ""}</Text>
            </View>
          </View>

          {GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.card}>
                {group.items.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <Pressable
                      key={item.href}
                      style={[styles.row, idx > 0 && styles.rowBorder]}
                      onPress={() => router.push(item.href as never)}
                    >
                      <View style={[styles.iconBox, { backgroundColor: item.tint }]}>
                        <Icon size={18} color={item.color} strokeWidth={2.4} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>{item.label}</Text>
                        {item.hint ? <Text style={styles.rowHint}>{item.hint}</Text> : null}
                      </View>
                      <ChevronRight size={18} color={p.faint} strokeWidth={2.2} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <Pressable
            style={styles.signOut}
            onPress={async () => {
              await signOut();
              router.replace("/(auth)/login" as never);
            }}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  profileName: { ...typography.h3, color: p.text },
  profileEmail: { color: p.muted, marginTop: 2, fontSize: 13 },
  group: { marginBottom: spacing.lg },
  groupTitle: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: p.border,
    overflow: "hidden",
    ...softShadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: p.border },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: p.text, fontWeight: "700", fontSize: 15 },
  rowHint: { color: p.muted, fontSize: 12, marginTop: 2 },
  signOut: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: p.redSoft,
  },
  signOutText: { color: p.red, fontWeight: "700" },
});
