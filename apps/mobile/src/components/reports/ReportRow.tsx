import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

type Props = {
  title: string;
  subtitle?: string;
  amount?: string;
  amountTone?: "default" | "positive" | "negative";
  meta?: string;
  metaTone?: "muted" | "warning" | "positive";
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  seed?: string;
  onPress?: () => void;
};

export function ReportRow({ title, subtitle, amount, amountTone = "default", meta, metaTone = "muted", icon, seed, onPress }: Props) {
  const body = (
    <>
      {icon ? <Avatar name={title} seed={seed || title} icon={icon} shape="rounded" size={42} /> : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {amount ? (
          <Text style={[styles.amount, amountTone === "positive" && styles.positive, amountTone === "negative" && styles.negative]}>
            {amount}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.meta, metaTone === "warning" && styles.metaWarning, metaTone === "positive" && styles.metaPositive]}>
            {meta}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={16} color={p.faint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
    ...softShadow,
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontSize: 15, fontWeight: "700" },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  right: { alignItems: "flex-end", maxWidth: "45%" },
  amount: { color: p.text, fontSize: 15, fontWeight: "800" },
  positive: { color: p.green },
  negative: { color: p.red },
  meta: { color: p.faint, fontSize: 12, marginTop: 2, fontWeight: "600" },
  metaWarning: { color: p.amber },
  metaPositive: { color: p.green },
});
