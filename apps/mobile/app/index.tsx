import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store";
import { lightPalette, typography } from "@/lib/theme";

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => {
      router.replace(user ? "/(tabs)" : "/(auth)/login");
    }, 600);
    return () => clearTimeout(t);
  }, [isLoading, user, router]);

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
