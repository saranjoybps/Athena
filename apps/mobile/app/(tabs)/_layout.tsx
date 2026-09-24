import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Tabs, Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Home, Users, FolderKanban, Settings, Plus } from "lucide-react-native";
import { useAuthStore } from "@/store";
import { lightPalette as p } from "@/lib/theme";

/** Nested routes stay registered but off the tab bar. */
const HIDDEN = [
  "field",
  "quotes",
  "invoices",
  "expenses",
  "attendance",
  "sites",
  "materials",
  "suppliers",
  "labour",
  "payments",
  "snags",
  "change-orders",
  "surveys",
  "estimates",
  "measurements",
  "preview",
  "delivery-challans",
] as const;

const MAIN_TABS = ["index", "customers", "projects", "more"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const TAB_ICONS: Record<MainTab, typeof Home> = {
  index: Home,
  customers: Users,
  projects: FolderKanban,
  more: Settings,
};

/**
 * Reference geometry:
 * - rounded top corners
 * - deep U cutout in the center
 * - orange plus nested in the cutout with visible air gap (page shows through)
 */
const BAR_H = 72;
const CORNER_R = 28;
const FAB_SIZE = 54;
const FAB_GAP = 10;
const NOTCH_R = FAB_SIZE / 2 + FAB_GAP; // cutout larger than FAB → air ring
const BAR_FILL = "#FFF8F3";
/** Cubic-bezier circle constant */
const K = 0.5522847498;

type TabBarProps = {
  state: {
    index: number;
    routes: Array<{ key: string; name: string; params?: object }>;
  };
  navigation: {
    emit: (e: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

/**
 * Explicit downward cubics (not SVG arcs) — RN Android was clipping the arc
 * upward, which made the top edge look flat.
 */
function notchedBarPath(width: number, height: number) {
  const mid = width / 2;
  const cr = CORNER_R;
  const r = NOTCH_R;
  const c = r * K;
  return [
    `M 0 ${height}`,
    `L 0 ${cr}`,
    `Q 0 0 ${cr} 0`,
    `L ${mid - r} 0`,
    // Left half of semicircle dipping INTO the bar (+y)
    `C ${mid - r} ${c} ${mid - c} ${r} ${mid} ${r}`,
    // Right half back up to the top edge
    `C ${mid + c} ${r} ${mid + r} ${c} ${mid + r} 0`,
    `L ${width - cr} 0`,
    `Q ${width} 0 ${width} ${cr}`,
    `L ${width} ${height}`,
    `Z`,
  ].join(" ");
}

function SoftTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const activeName = state.routes[state.index]?.name;
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);
  const totalH = BAR_H + bottomInset;
  // Center of FAB sits on the bar top edge → nests in the U with equal air gap
  const fabBottom = totalH - FAB_SIZE / 2;

  const leftTabs: MainTab[] = ["index", "customers"];
  const rightTabs: MainTab[] = ["projects", "more"];

  function goTab(name: MainTab) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (event.defaultPrevented) return;
    if (name === "index") navigation.navigate("index");
    else navigation.navigate(route.name, { screen: "index" });
  }

  function renderTab(name: MainTab) {
    const isFocused = activeName === name || (name === "more" && String(activeName || "").startsWith("more"));
    const Icon = TAB_ICONS[name];
    return (
      <Pressable
        key={name}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onPress={() => goTab(name)}
        style={styles.tabBtn}
        hitSlop={10}
      >
        <View>
          <Icon
            size={26}
            color={isFocused ? p.clayDark : "rgba(234,88,12,0.42)"}
            strokeWidth={isFocused ? 2.6 : 2.1}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.root, { height: totalH + FAB_SIZE / 2 + 6 }]} pointerEvents="box-none">
      <View style={[styles.barShadow, { height: totalH }]} pointerEvents="none">
        <Svg width={width} height={totalH} style={styles.svg}>
          <Path d={notchedBarPath(width, totalH > BAR_H ? BAR_H : totalH)} fill={BAR_FILL} />
          {bottomInset > 0 ? (
            <Path d={`M 0 ${BAR_H} H ${width} V ${totalH} H 0 Z`} fill={BAR_FILL} />
          ) : null}
        </Svg>
      </View>

      <View style={[styles.iconsOverlay, { height: BAR_H, bottom: bottomInset }]}>
        <View style={styles.side}>{leftTabs.map(renderTab)}</View>
        <View style={{ width: NOTCH_R * 2 + 8 }} />
        <View style={styles.side}>{rightTabs.map(renderTab)}</View>
      </View>

      <View style={[styles.fabWrap, { bottom: fabBottom }]} pointerEvents="box-none">
        <Pressable
          style={styles.fab}
          onPress={() => router.push("/(tabs)/customers/new" as never)}
          accessibilityLabel="Quick add"
        >
          <Plus size={28} color="#FFFFFF" strokeWidth={2.8} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!user.orgId) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <SoftTabBar {...(props as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Default bar paints a flat rectangle that hides the SVG notch cutout
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", href: "/" }} />
      <Tabs.Screen name="customers" options={{ title: "Customers", href: "/customers" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects", href: "/projects" }} />
      <Tabs.Screen name="more" options={{ title: "More", href: "/more" }} />
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  barShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B2E",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -3 },
      },
      // Avoid Android elevation fill — it paints a flat rectangle over the cutout
      android: {},
      default: {},
    }),
  },
  svg: {
    backgroundColor: "transparent",
  },
  iconsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 5,
  },
  side: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  tabBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
  },
  fabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
  },
});
