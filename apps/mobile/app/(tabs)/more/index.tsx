import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, ChevronRight, Settings2, Wrench, Package } from "lucide-react-native";
import { signOut } from "@/lib/auth";
import { useAuthStore } from "@/store";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { cardShadow, lightPalette as p, radius, spacing, typography } from "@/lib/theme";

const LINKS: { label: string; href: string; hint?: string; icon: typeof BookOpen }[] = [
  { label: "Accounts", href: "/(tabs)/more/accounts", hint: "P&L, receivables, ledger", icon: BookOpen },
  { label: "API & device", href: "/(tabs)/more/settings", hint: "Server URL for APK installs", icon: Settings2 },
  { label: "Field tools", href: "/(tabs)/field", hint: "Attendance, snags, change orders", icon: Wrench },
  { label: "Catalog", href: "/(tabs)/more/catalog", hint: "Materials, suppliers, labour", icon: Package },
];

export default function SettingsHubScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Settings" />

        <View style={styles.card}>
          <Text style={styles.name}>{user?.businessName || "Athena"}</Text>
          <Text style={styles.meta}>{user?.email || user?.userId}</Text>
          <Text style={styles.meta}>Roles: {(user?.roles || []).join(", ") || "—"}</Text>
        </View>

        {LINKS.map((l) => {
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
  content: { padding: spacing.lg, paddingBottom: 110 },
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
  signOut: { marginTop: spacing.lg, padding: spacing.md, alignItems: "center" },
  signOutText: { color: p.red, fontWeight: "700" },
});
