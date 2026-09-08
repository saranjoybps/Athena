import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { lightPalette as p, spacing } from "@/lib/theme";

type TabItem<T extends string> = { key: T; label: string };

/** Modern underline segment control for hub screens */
export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab}>
              <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
              <View style={[styles.underline, on && styles.underlineOn]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: p.border,
    marginBottom: spacing.sm,
  },
  row: { paddingHorizontal: spacing.lg, gap: 4 },
  tab: { paddingTop: 4, paddingBottom: 0, paddingHorizontal: 10, alignItems: "center" },
  label: { color: p.muted, fontWeight: "600", fontSize: 14, paddingVertical: 10 },
  labelOn: { color: p.clayDark, fontWeight: "700" },
  underline: { height: 3, width: "100%", borderRadius: 2, backgroundColor: "transparent" },
  underlineOn: { backgroundColor: p.clay },
});
