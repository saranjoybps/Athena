import { StyleSheet, Text, View } from "react-native";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

export function StatePill({ label, tone }: { label: string; tone: { color: string; soft: string } }) {
  return (
    <View style={[styles.pill, { backgroundColor: tone.soft }]}>
      <View style={[styles.dot, { backgroundColor: tone.color }]} />
      <Text style={[styles.pillText, { color: tone.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
    ...softShadow,
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontSize: 16, fontWeight: "700" },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500", flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 },
  meta: { color: p.muted, fontSize: 12, fontWeight: "600" },
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
});
