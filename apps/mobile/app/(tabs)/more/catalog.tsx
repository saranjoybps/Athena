import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, HardHat, Package, Users, Wrench } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { cardShadow, lightPalette as p, radius, spacing, typography, tabBarClearance } from "@/lib/theme";

const LINKS = [
  { label: "Materials", href: "/(tabs)/materials", hint: "Paint, consumables, rates", icon: Package },
  { label: "Labour", href: "/(tabs)/labour", hint: "Workers and day rates", icon: HardHat },
  { label: "Crews", href: "/(tabs)/labour?tab=crews", hint: "Site crews", icon: Users },
  { label: "Tools", href: "/(tabs)/more/tools", hint: "Site tools and equipment", icon: Wrench },
];

export default function InventoryHub() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Inventory" subtitle="Materials, labour, crews, tools" onBack={() => router.back()} />
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Pressable key={l.href} style={styles.link} onPress={() => router.push(l.href as never)}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={p.clay} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkText}>{l.label}</Text>
                <Text style={styles.hint}>{l.hint}</Text>
              </View>
              <ChevronRight size={18} color={p.faint} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
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
  linkText: { ...typography.h3, color: p.text, fontWeight: "700" },
  hint: { color: p.muted, marginTop: 2, fontSize: 13 },
});
