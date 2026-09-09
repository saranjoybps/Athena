import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabBarClearance } from "@/lib/theme";

/** Bottom padding for ScrollView/FlatList content under the floating tab bar. */
export function useTabBarContentPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  return Math.max(tabBarClearance, 72 + Math.max(insets.bottom, 12) + 24) + extra;
}
