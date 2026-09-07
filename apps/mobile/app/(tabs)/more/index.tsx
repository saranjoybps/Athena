import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/auth";
import { useAuthStore } from "@/store";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

const SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Pipeline",
    links: [
      { label: "Customers", href: "/(tabs)/customers" },
      { label: "Sites", href: "/(tabs)/sites" },
      { label: "Estimates", href: "/(tabs)/estimates" },
      { label: "Quotes", href: "/(tabs)/quotes" },
      { label: "Projects", href: "/(tabs)/projects" },
    ],
  },
  {
    title: "Money",
    links: [
      { label: "Accounts", href: "/(tabs)/more/accounts" },
      { label: "Invoices", href: "/(tabs)/invoices" },
      { label: "Payments", href: "/(tabs)/payments" },
      { label: "Expenses", href: "/(tabs)/expenses" },
    ],
  },
  {
    title: "Field",
    links: [
      { label: "Attendance", href: "/(tabs)/attendance" },
      { label: "Snags", href: "/(tabs)/snags" },
      { label: "Change orders", href: "/(tabs)/change-orders" },
    ],
  },
  {
    title: "Catalog",
    links: [
      { label: "Materials", href: "/(tabs)/materials" },
      { label: "Suppliers", href: "/(tabs)/suppliers" },
      { label: "Labour", href: "/(tabs)/labour" },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>More</Text>
        <View style={styles.card}>
          <Text style={styles.name}>{user?.businessName || "Athena"}</Text>
          <Text style={styles.meta}>{user?.email || user?.userId}</Text>
          <Text style={styles.meta}>Roles: {(user?.roles || []).join(", ") || "—"}</Text>
        </View>
        <Text style={styles.hint}>Surveys & measurements are inside each Site. Set API URL under Settings for APK installs.</Text>
        <Pressable style={styles.link} onPress={() => router.push("/(tabs)/more/settings" as never)}>
          <Text style={styles.linkText}>Settings (API URL)</Text>
          <Text style={{ color: p.clay }}>→</Text>
        </Pressable>
        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: spacing.md }}>
            <Text style={styles.section}>{section.title}</Text>
            {section.links.map((l) => (
              <Pressable key={l.href} style={styles.link} onPress={() => router.push(l.href as never)}>
                <Text style={styles.linkText}>{l.label}</Text>
                <Text style={{ color: p.clay }}>→</Text>
              </Pressable>
            ))}
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
  content: { padding: spacing.lg, paddingBottom: 48 },
  title: { ...typography.h1, color: p.text, fontSize: 24, marginBottom: spacing.md },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: spacing.sm,
  },
  name: { ...typography.h3, color: p.text },
  meta: { color: p.muted, marginTop: 4 },
  hint: { color: p.faint, fontSize: 12, marginBottom: spacing.lg },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },
  link: {
    backgroundColor: p.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: p.border,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    alignItems: "center",
  },
  linkText: { color: p.text, fontWeight: "600", fontSize: 15 },
  signOut: { marginTop: spacing.md, padding: spacing.md, alignItems: "center" },
  signOutText: { color: p.red, fontWeight: "700" },
});
