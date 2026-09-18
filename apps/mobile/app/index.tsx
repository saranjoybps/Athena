import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useAuthStore } from "@/store";
import { firebaseAuth, getIdToken } from "@/lib/firebase";
import { refreshSession } from "@/lib/auth";
import { lightPalette, typography } from "@/lib/theme";

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        await getIdToken(true);
        await refreshSession();
      } catch {
        setUser(null);
        const a = firebaseAuth();
        if (a) await a.signOut().catch(() => undefined);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [setUser, setLoading]);

  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => {
      if (!user) router.replace("/(auth)/login");
      else if (!user.orgId) router.replace("/(auth)/onboarding");
      else router.replace("/(tabs)");
    }, 400);
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
