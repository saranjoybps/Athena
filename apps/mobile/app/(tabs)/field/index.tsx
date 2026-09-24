import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ClipboardList,
  FolderKanban,
  MapPin,
  Package,
  Users,
  Wallet,
} from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { lightPalette as p, radius, spacing, typography, softShadow, tabBarClearance } from "@/lib/theme";

type Action = {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof ClipboardList;
  tint: string;
  color: string;
};

const PRIMARY: Action[] = [
  { title: "Attendance", subtitle: "Present / half / leave", href: "/(tabs)/attendance", icon: ClipboardList, tint: p.sky, color: p.blue },
];

const SITES: Action[] = [
  { title: "Sites", subtitle: "Surveys & measurements", href: "/(tabs)/sites", icon: MapPin, tint: p.mint, color: p.green },
  { title: "Projects", subtitle: "Active site jobs", href: "/(tabs)/projects", icon: FolderKanban, tint: p.peach, color: p.clay },
  { title: "Customers", subtitle: "CRM & follow-ups", href: "/(tabs)/customers", icon: Users, tint: p.lilac, color: p.purple },
  { title: "Record payment", subtitle: "Collect against invoice", href: "/(tabs)/payments/new", icon: Wallet, tint: p.butter, color: p.amber },
  { title: "Materials", subtitle: "Inventory rates & HSN", href: "/(tabs)/materials", icon: Package, tint: p.claySoft, color: p.clayDark },
];

export default function FieldHome() {
  const router = useRouter();
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title="Field tools"
            subtitle="Attendance and site logging"
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
    </SoftBackground>
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
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  section: { ...typography.h3, color: p.text, marginBottom: 12, marginTop: 8, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.md },
  tile: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    width: "100%",
    ...softShadow,
  },
  tileHalf: { width: "100%" },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { color: p.text, fontWeight: "800", fontSize: 15 },
  tileSub: { color: p.muted, fontSize: 12, marginTop: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 10,
    ...softShadow,
  },
  cardTitle: { color: p.text, fontWeight: "800" },
  cardSub: { color: p.muted, fontSize: 12, marginTop: 2 },
  chev: { color: p.faint, fontSize: 18, fontWeight: "700" },
});
