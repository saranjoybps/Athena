import { Pressable, StyleSheet, Text, View } from "react-native";
import { cardShadow, lightPalette, radius, spacing, typography } from "@/lib/theme";

const STATUS: Record<string, { color: string; bg: string }> = {
  draft: { color: lightPalette.muted, bg: lightPalette.slateSoft },
  sent: { color: lightPalette.blue, bg: lightPalette.blueSoft },
  accepted: { color: lightPalette.green, bg: lightPalette.greenSoft },
  rejected: { color: lightPalette.red, bg: lightPalette.redSoft },
  invoiced: { color: lightPalette.purple, bg: lightPalette.purpleSoft },
  paid: { color: lightPalette.green, bg: lightPalette.greenSoft },
  partially_paid: { color: lightPalette.amber, bg: lightPalette.amberSoft },
  active: { color: lightPalette.clay, bg: lightPalette.claySoft },
  planned: { color: lightPalette.blue, bg: lightPalette.blueSoft },
  completed: { color: lightPalette.green, bg: lightPalette.greenSoft },
};

export function RecordCard({
  title,
  subtitle,
  meta,
  status,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  onPress?: () => void;
}) {
  const cfg = STATUS[status || ""] ?? { color: lightPalette.muted, bg: lightPalette.slateSoft };
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {status ? (
        <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.pillText, { color: cfg.color }]}>{status}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: lightPalette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: lightPalette.border,
    ...cardShadow,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  title: { ...typography.h3, color: lightPalette.text },
  subtitle: { color: lightPalette.muted, marginTop: 2, fontSize: 13 },
  meta: { color: lightPalette.faint, marginTop: 4, fontSize: 12 },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
