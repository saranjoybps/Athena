import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ClipboardList,
  FolderKanban,
  IndianRupee,
  MapPin,
  Package,
  Users,
  Wallet,
} from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing, typography, cardShadow, tabBarClearance } from "@/lib/theme";

type Action = {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof IndianRupee;
  tint: string;
  color: string;
};

const PRIMARY: Action[] = [
  { title: "Log expense", subtitle: "Cash / UPI site spend", href: "/(tabs)/expenses/new", icon: IndianRupee, tint: p.claySoft, color: p.clay },
  { title: "Attendance", subtitle: "Mark present / OT", href: "/(tabs)/attendance", icon: ClipboardList, tint: p.blueSoft, color: p.blue },
  { title: "Log snag", subtitle: "Defects & punch list", href: "/(tabs)/snags/new", icon: AlertTriangle, tint: p.redSoft, color: p.red },
];

const SITES: Action[] = [
  { title: "Sites", subtitle: "Surveys & measurements", href: "/(tabs)/sites", icon: MapPin, tint: p.greenSoft, color: p.green },
  { title: "Projects", subtitle: "Active site jobs", href: "/(tabs)/projects", icon: FolderKanban, tint: p.claySoft, color: p.clay },
  { title: "Customers", subtitle: "CRM & follow-ups", href: "/(tabs)/customers", icon: Users, tint: p.blueSoft, color: p.blue },
  { title: "Record payment", subtitle: "Collect against invoice", href: "/(tabs)/payments/new", icon: Wallet, tint: p.claySoft, color: p.clay },
  { title: "Materials", subtitle: "Catalog & prices", href: "/(tabs)/materials", icon: Package, tint: p.amberSoft, color: p.amber },
];

export default function FieldHome() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Field tools"
          subtitle="Attendance, snags, and site logging"
          onBack={() => router.replace("/(tabs)/more" as never)}
        />

        <Text style={styles.section}>On site now</Text>
        <View style={styles.grid}>
          {PRIMARY.map((a) => (
            <ActionTile key={a.href + a.title} action={a} onPress={() => router.push(a.href as never)} compact />
          ))}
        </View>

        <Text style={styles.section}>Jobs & people</Text>
        {SITES.map((a) => (
          <ActionRow key={a.href + a.title} action={a} onPress={() => router.push(a.href as never)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({ action, onPress, compact }: { action: Action; onPress: () => void; compact?: boolean }) {
  const Icon = action.icon;
  return (
    <Pressable style={[styles.tile, compact && styles.tileHalf]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: action.tint }]}>
        <Icon size={22} color={action.color} />
      </View>
      <Text style={styles.tileTitle}>{action.title}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>
        {action.subtitle}
      </Text>
    </Pressable>
  );
}

function ActionRow({ action, onPress }: { action: Action; onPress: () => void }) {
  const Icon = action.icon;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: action.tint }]}>
        <Icon size={22} color={action.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{action.title}</Text>
        <Text style={styles.cardSub}>{action.subtitle}</Text>
      </View>
      <Text style={styles.chev}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  title: { ...typography.h1, color: p.text, fontSize: 24 },
  sub: { color: p.muted, marginBottom: spacing.md, marginTop: 4 },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: spacing.sm,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.md },
  tile: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    minHeight: 120,
    ...cardShadow,
  },
  tileHalf: { width: "48%", flexGrow: 1 },
  tileTitle: { ...typography.h3, color: p.text, marginTop: 10, fontSize: 15 },
  tileSub: { color: p.muted, fontSize: 12, marginTop: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: p.border,
    minHeight: 72,
    ...cardShadow,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { ...typography.h3, color: p.text },
  cardSub: { color: p.muted, fontSize: 13, marginTop: 2 },
  chev: { color: p.clay, fontWeight: "700", fontSize: 18 },
});
