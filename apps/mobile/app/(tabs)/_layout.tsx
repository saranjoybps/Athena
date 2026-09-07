import { Tabs, Redirect } from "expo-router";
import { LayoutDashboard, HardHat, FileText, Wrench, Menu } from "lucide-react-native";
import { Platform } from "react-native";
import { lightPalette } from "@/lib/theme";
import { useAuthStore } from "@/store";

const HIDDEN = [
  "customers",
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
] as const;

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();
  if (!isLoading && !user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lightPalette.clay,
        tabBarInactiveTintColor: lightPalette.muted,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          backgroundColor: "#ffffff",
          borderTopColor: lightPalette.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tabs.Screen name="field" options={{ title: "Field", tabBarIcon: ({ color, size }) => <Wrench size={size} color={color} /> }} />
      <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: ({ color, size }) => <HardHat size={size} color={color} /> }} />
      <Tabs.Screen name="quotes" options={{ title: "Quotes", tabBarIcon: ({ color, size }) => <FileText size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color, size }) => <Menu size={size} color={color} /> }} />
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
