import { View, Text, StyleSheet } from "react-native";
import { EmptyIllustration } from "@/components/ui/EmptyIllustration";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { lightPalette as p, spacing, typography } from "@/lib/theme";

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
      <EmptyIllustration size={128} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} showArrow onPress={onAction} style={{ marginTop: spacing.md, alignSelf: "stretch" }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  title: { ...typography.h2, color: p.text, fontWeight: "800", textAlign: "center", marginTop: spacing.md, fontSize: 20 },
  subtitle: { color: p.muted, marginTop: 8, textAlign: "center", lineHeight: 21, paddingHorizontal: 12 },
});
