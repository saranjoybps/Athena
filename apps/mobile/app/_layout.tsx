import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { onAuthStateChanged } from "firebase/auth";
import { lightPalette } from "@/lib/theme";
import { useAuthStore } from "@/store";
import { firebaseAuth, getIdToken } from "@/lib/firebase";
import { refreshSession } from "@/lib/auth";
import { toastConfig } from "@/components/ui/ToastConfig";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (count, err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // One retry on 401 covers residual cold-start races after Firebase restores.
        if (status === 401) return count < 1;
        if (status === 403) return false;
        return count < 1;
      },
      retryDelay: (attempt) => (attempt === 0 ? 400 : 1000),
    },
  },
});

/**
 * Restore Firebase persistence + /me once on cold start before mounting routes.
 * Uses local bootReady so later login isLoading does not unmount the tree.
 */
function AuthBootstrap({ children }: { children: ReactNode }) {
  const [bootReady, setBootReady] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const settled = useRef(false);

  useEffect(() => {
    setLoading(true);
    const auth = firebaseAuth();
    if (!auth) {
      setUser(null);
      setLoading(false);
      setBootReady(true);
      SplashScreen.hideAsync().catch(() => undefined);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (settled.current) return;
      settled.current = true;
      try {
        if (!fbUser) {
          setUser(null);
          return;
        }
        await getIdToken(true);
        await refreshSession();
      } catch {
        setUser(null);
        await auth.signOut().catch(() => undefined);
      } finally {
        setLoading(false);
        setBootReady(true);
        SplashScreen.hideAsync().catch(() => undefined);
      }
    });
    return () => unsub();
  }, [setUser, setLoading]);

  if (!bootReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={lightPalette.clay} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" backgroundColor={lightPalette.background} />
        <AuthBootstrap>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: lightPalette.background } }}>
            <Stack.Screen name="index" options={{ animation: "none" }} />
            <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
            <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          </Stack>
        </AuthBootstrap>
        <Toast config={toastConfig} topOffset={56} visibilityTime={2800} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightPalette.background,
  },
});
