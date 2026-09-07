import { Pressable, View, Text, StyleSheet } from "react-native";
import { lightPalette, spacing, typography } from "@/lib/theme";

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.xl,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lightPalette.border,
    borderStyle: "dashed",
    backgroundColor: lightPalette.surface,
  },
  title: { ...typography.h3, color: lightPalette.text },
  subtitle: { color: lightPalette.muted, marginTop: 6, textAlign: "center" },
  btn: {
    marginTop: spacing.md,
    backgroundColor: lightPalette.clay,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
