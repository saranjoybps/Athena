import { View, Text, StyleSheet } from "react-native";
import { cardShadow, lightPalette, radius, spacing, typography } from "@/lib/theme";

export function StatCard({ label, value, tint = lightPalette.claySoft, color = lightPalette.clay }: {
  label: string;
  value: string;
  tint?: string;
  color?: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: tint }]}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    borderRadius: radius.lg,
    padding: spacing.md,
    ...cardShadow,
  },
  value: { ...typography.h2 },
  label: { color: lightPalette.muted, marginTop: 4, fontSize: 12, fontWeight: "600" },
});
