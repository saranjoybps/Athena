import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store";
import { lightPalette, typography } from "@/lib/theme";

/** Route gate after AuthBootstrap has restored Firebase (and /me or the cached session). */
export default function SplashScreen() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (!isLoading) {
    if (!user) return <Redirect href="/(auth)/login" />;
    if (!user.orgId) return <Redirect href="/(auth)/onboarding" />;
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.box}>
      <Text style={styles.brand}>Athena</Text>
      <Text style={styles.tag}>Contractor operations</Text>
      <ActivityIndicator color={lightPalette.clay} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: lightPalette.background },
  brand: { ...typography.h1, color: lightPalette.clay },
  tag: { color: lightPalette.muted, marginTop: 8 },
});
