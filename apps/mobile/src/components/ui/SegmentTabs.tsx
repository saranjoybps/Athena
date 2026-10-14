import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { lightPalette as p, spacing, radius, softShadow } from "@/lib/theme";

type TabItem<T extends string> = { key: T; label: string };

/** Soft pill segment control. Scrolls edge to edge and keeps the active tab in view. */
export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  padded = true,
  floating = false,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Horizontal inset — turn off when nested inside an already-padded header. */
  padded?: boolean;
  /** White rounded track — use for sticky bars over the soft background. */
  floating?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, { x: number; width: number }>>({});
  const viewport = useRef(0);

  useEffect(() => {
    const pos = positions.current[value];
    if (!pos || !viewport.current) return;
    const target = Math.max(0, pos.x - (viewport.current - pos.width) / 2);
    scroll.current?.scrollTo({ x: target, animated: true });
  }, [value]);

  const row = (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => (viewport.current = e.nativeEvent.layout.width)}
      contentContainerStyle={[styles.row, floating ? styles.rowFloating : padded ? styles.rowPadded : null]}
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            onLayout={(e) => (positions.current[t.key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            style={[styles.tab, floating && styles.tabFloating, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (floating) {
    return (
      <View style={[styles.floatWrap, !padded && styles.floatWrapFlush]}>
        <View style={styles.track}>{row}</View>
      </View>
    );
  }
  return <View style={styles.wrap}>{row}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { gap: 8, paddingVertical: 2 },
  rowPadded: { paddingHorizontal: spacing.lg },
  rowFloating: { gap: 4, padding: 5 },
  floatWrap: { paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: 10 },
  floatWrapFlush: { paddingHorizontal: 0 },
  track: {
    backgroundColor: p.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: p.border,
    overflow: "hidden",
    ...softShadow,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  tabFloating: { borderColor: "transparent", backgroundColor: "transparent", paddingVertical: 9 },
  tabOn: {
    backgroundColor: p.clay,
    borderColor: p.clay,
  },
  label: { color: p.muted, fontWeight: "700", fontSize: 13 },
  labelOn: { color: "#fff" },
});
