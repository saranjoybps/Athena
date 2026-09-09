import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Users, FolderKanban, Settings } from "lucide-react-native";
import { useAuthStore } from "@/store";

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
] as const;

const MAIN_TABS = ["index", "customers", "projects", "more"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const TAB_ICONS: Record<MainTab, typeof Home> = {
  index: Home,
  customers: Users,
  projects: FolderKanban,
  more: Settings,
};

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

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const tabs = MAIN_TABS.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is { key: string; name: string; params?: object } => Boolean(r),
  );

  return (
    <View pointerEvents="box-none" style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {tabs.map((route) => {
          const name = route.name as MainTab;
          const isFocused = activeName === route.name || (name === "more" && activeName?.startsWith("more"));
          const Icon = TAB_ICONS[name];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
                // Always land on the list/root of each tab — don't restore nested screens like customers/new.
                if (name === "index") {
                  navigation.navigate("index");
                } else {
                  navigation.navigate(route.name, { screen: "index" });
                }
              }}
              style={styles.tabBtn}
              hitSlop={10}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Icon size={22} color={isFocused ? "#0F172A" : "rgba(255,255,255,0.88)"} strokeWidth={isFocused ? 2.6 : 2} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();
  if (!isLoading && !user) return <Redirect href="/(auth)/login" />;
  if (!isLoading && user && !user.orgId) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...(props as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
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
  barWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 268,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  tabBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "#FFFFFF",
  },
});
