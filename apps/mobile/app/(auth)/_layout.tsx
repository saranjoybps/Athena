import { Stack, Redirect, usePathname } from "expo-router";
import { useAuthStore } from "@/store";

export default function AuthLayout() {
  const { user, isLoading } = useAuthStore();
  const pathname = usePathname();
  // Signed-in with org → app. Without org → stay in auth for onboarding.
  if (!isLoading && user?.orgId) return <Redirect href="/(tabs)" />;
  if (!isLoading && user && !user.orgId && !pathname?.includes("onboarding")) {
    return <Redirect href="/(auth)/onboarding" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
