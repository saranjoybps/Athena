import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { lightPalette as p, spacing, typography } from "@/lib/theme";

export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={20} color={p.text} strokeWidth={2.4} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: 8,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10, minWidth: 0 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: p.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: p.border,
  },
  title: { ...typography.h2, color: p.text },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2 },
});
