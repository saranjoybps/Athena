import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Props = {
  title: string;
  subtitle?: string;
  accent?: "clay" | "amber" | "green";
  children: ReactNode;
  footerLabel: string;
  footerBusy?: boolean;
  footerDisabled?: boolean;
  onFooterPress: () => void;
};

const ACCENT = {
  clay: p.clay,
  amber: "#B45309",
  green: "#059669",
};

/** Shared create-document chrome: accent header + sticky primary action. */
export function DocumentFormChrome({
  title,
  subtitle,
  accent = "clay",
  children,
  footerLabel,
  footerBusy,
  footerDisabled,
  onFooterPress,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderLeftColor: ACCENT[accent] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </View>
      <View style={styles.footer}>
        <Pressable
          onPress={onFooterPress}
          disabled={footerBusy || footerDisabled}
          style={[styles.btn, (footerBusy || footerDisabled) && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>{footerBusy ? "Saving…" : footerLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: p.border,
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    backgroundColor: p.surface,
    overflow: "hidden",
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 22, fontWeight: "700", color: p.text },
  subtitle: { marginTop: 4, fontSize: 14, color: p.muted, lineHeight: 20 },
  body: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    marginBottom: spacing.sm,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: p.muted,
  },
  footer: {
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  btn: {
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
