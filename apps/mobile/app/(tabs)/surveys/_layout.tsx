import { Stack } from "expo-router";
import { lightPalette } from "@/lib/theme";

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: lightPalette.background } }} />;
}
