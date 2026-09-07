import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/store";

export default function AuthLayout() {
  const { user, isLoading } = useAuthStore();
  if (!isLoading && user) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
