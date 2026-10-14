import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { UserRound, UsersRound } from "lucide-react-native";
import { lightPalette as p, radius } from "@/lib/theme";

export type PeopleTab = "workers" | "crews";

const ITEMS: { key: PeopleTab; label: string; icon: typeof UserRound }[] = [
  { key: "workers", label: "Workers", icon: UserRound },
  { key: "crews", label: "Crews", icon: UsersRound },
];

const PAD = 5;

type Props = {
  value: PeopleTab;
  onChange: (tab: PeopleTab) => void;
  counts: Partial<Record<PeopleTab, number | undefined>>;
};

export function PeopleTabs({ value, onChange, counts }: Props) {
  const [width, setWidth] = useState(0);
  const index = ITEMS.findIndex((i) => i.key === value);
  const position = useRef(new Animated.Value(index)).current;
  const segment = width > 0 ? (width - PAD * 2) / ITEMS.length : 0;

  useEffect(() => {
    Animated.spring(position, {
      toValue: index,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [index, position]);

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segment,
              transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, segment] }) }],
            },
          ]}
        />
      ) : null}
      {ITEMS.map((item) => {
        const on = item.key === value;
        const Icon = item.icon;
        const count = counts[item.key];
        return (
          <Pressable
            key={item.key}
            style={styles.segment}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={count == null ? item.label : `${item.label}, ${count}`}
          >
            <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
              <Icon size={16} color={on ? "#FFFFFF" : p.clayDark} strokeWidth={2.4} />
            </View>
            <Text style={[styles.label, on && styles.labelOn]}>{item.label}</Text>
            {count != null ? (
              <View style={[styles.badge, on && styles.badgeOn]}>
                <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PAD,
    borderRadius: radius.lg,
    backgroundColor: p.clayMid,
    borderWidth: 1,
    borderColor: "#FED7AA",
    marginBottom: 8,
  },
  thumb: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.lg - PAD,
    backgroundColor: p.surface,
    ...Platform.select({
      ios: {
        shadowColor: "#C2410C",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  iconWrapOn: { backgroundColor: p.clay },
  label: { color: p.clayDark, fontWeight: "600", fontSize: 15, opacity: 0.75 },
  labelOn: { color: p.text, fontWeight: "800", opacity: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  badgeOn: { backgroundColor: p.claySoft, borderWidth: 1, borderColor: "#FED7AA" },
  badgeText: { color: p.clayDark, fontWeight: "700", fontSize: 12 },
  badgeTextOn: { color: p.clayDark },
});
