import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { lightPalette as p, spacing, radius } from "@/lib/theme";

type TabItem<T extends string> = { key: T; label: string };

/** Soft pill segment control (mockup filter chips). */
export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  padded = true,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Horizontal inset — turn off when nested inside an already-padded header. */
  padded?: boolean;
}) {
  return (
    <View style={[styles.wrap, !padded && styles.wrapFlush]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  wrapFlush: { paddingHorizontal: 0 },
  row: { gap: 8, paddingVertical: 2, paddingRight: spacing.lg },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  tabOn: {
    backgroundColor: p.clay,
    borderColor: p.clay,
  },
  label: { color: p.muted, fontWeight: "700", fontSize: 13 },
  labelOn: { color: "#fff" },
});
