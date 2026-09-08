import { View, Text, StyleSheet } from "react-native";
import { cardShadow, lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export function StatCard({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  /** Orange accent for primary metric */
  emphasize?: boolean;
}) {
  return (
    <View style={[styles.card, emphasize && styles.cardEmph]}>
      <Text style={[styles.value, emphasize && styles.valueEmph]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    ...cardShadow,
  },
  cardEmph: {
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  value: { ...typography.h2, color: p.text, fontSize: 22 },
  valueEmph: { color: p.clayDark },
  label: { color: p.muted, marginTop: 6, fontSize: 12, fontWeight: "600" },
});
