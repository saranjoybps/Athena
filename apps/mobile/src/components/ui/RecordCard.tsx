import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { softShadow, lightPalette as p, radius, typography } from "@/lib/theme";

const STATUS: Record<string, { color: string; bg: string }> = {
  draft: { color: p.muted, bg: p.slateSoft },
  sent: { color: p.clayDark, bg: p.claySoft },
  accepted: { color: p.green, bg: p.greenSoft },
  approved: { color: p.green, bg: p.greenSoft },
  rejected: { color: p.red, bg: p.redSoft },
  invoiced: { color: p.clayDark, bg: p.claySoft },
  paid: { color: p.green, bg: p.greenSoft },
  partially_paid: { color: p.amber, bg: p.amberSoft },
  active: { color: p.clayDark, bg: p.claySoft },
  scheduled: { color: p.muted, bg: p.slateSoft },
  planned: { color: p.muted, bg: p.slateSoft },
  completed: { color: p.green, bg: p.greenSoft },
  on_hold: { color: p.amber, bg: p.amberSoft },
  present: { color: p.green, bg: p.greenSoft },
  half_day: { color: p.amber, bg: p.amberSoft },
  leave: { color: p.red, bg: p.redSoft },
};

export function RecordCard({
  title,
  subtitle,
  meta,
  status,
  onPress,
  leading,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  onPress?: () => void;
  leading?: React.ReactNode;
}) {
  const cfg = STATUS[status || ""] ?? { color: p.muted, bg: p.slateSoft };
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {status ? (
        <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.pillText, { color: cfg.color }]}>{status.replace(/_/g, " ")}</Text>
        </View>
      ) : null}
      {onPress ? <ChevronRight size={18} color={p.faint} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: p.border,
    ...softShadow,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  leading: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.h3, color: p.text, fontWeight: "800" },
  subtitle: { color: p.muted, marginTop: 3, fontSize: 13, lineHeight: 18 },
  meta: { color: p.faint, marginTop: 4, fontSize: 12 },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
