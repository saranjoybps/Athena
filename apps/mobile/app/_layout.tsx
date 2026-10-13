import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { onAuthStateChanged } from "firebase/auth";
import { lightPalette } from "@/lib/theme";
import { useAuthStore } from "@/store";
import { firebaseAuth, getPersistedFirebaseUid } from "@/lib/firebase";
import { refreshSession, signOut } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { toastConfig } from "@/components/ui/ToastConfig";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Firebase restores the stored user over the network; start that before the tree mounts.
firebaseAuth();

const HYDRATION_TIMEOUT_MS = 1500;

/** zustand persist never fires onFinishHydration if storage read fails, so cap the wait. */
function waitForAuthStoreHydration(): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, HYDRATION_TIMEOUT_MS);
    const unsub = useAuthStore.persist.onFinishHydration(done);
    function done() {
      clearTimeout(timer);
      unsub();
      resolve();
    }
  });
}

// Firebase has already dropped the local user when token refresh fails with these.
const FIREBASE_SESSION_ENDED = new Set([
  "auth/user-token-expired",
  "auth/user-disabled",
  "auth/invalid-user-token",
  "auth/user-not-found",
]);

function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function firebaseErrorCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

/** Background /me after a cached-session boot; only auth rejections end the session. */
async function revalidateSession() {
  try {
    await refreshSession();
  } catch (err) {
    const status = httpStatus(err);
    const code = firebaseErrorCode(err);
    if (status === 401 || status === 403 || (code && FIREBASE_SESSION_ENDED.has(code))) await signOut();
  }
}

/** Private tenant data must not outlive the Firebase identity that fetched it. */
function clearLocalSession() {
  useAuthStore.getState().clear();
  queryClient.clear();
}

/**
 * Restore the session once on cold start before mounting routes.
 * A cached session whose user matches Firebase's persisted uid opens as soon as
 * storage is read; Firebase's first auth callback then confirms it (or clears it)
 * and /me revalidates in the background. Otherwise /me is awaited before routing.
 * The same listener then tracks later sign-outs and identity changes.
 * Uses local bootReady so later login isLoading does not unmount the tree.
 */
function AuthBootstrap({ children }: { children: ReactNode }) {
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    const { setUser, setLoading } = useAuthStore.getState();
    setLoading(true);
    const finishBoot = () => {
      setBootReady(true);
      SplashScreen.hideAsync().catch(() => undefined);
    };
    const auth = firebaseAuth();
    if (!auth) {
      setUser(null);
      setLoading(false);
      finishBoot();
      return;
    }

    let booted = false;
    let lastUid: string | null = null;
    let optimisticUid: string | null = null;
    let disposed = false;

    // Requests still wait for Firebase's token (api interceptor); only route mounting overlaps it.
    void Promise.all([getPersistedFirebaseUid(), waitForAuthStoreHydration()]).then(([persistedUid]) => {
      if (disposed || booted || !persistedUid) return;
      const cached = useAuthStore.getState().user;
      if (cached?.orgId && cached.userId === persistedUid) {
        optimisticUid = persistedUid;
        setUser(cached);
        finishBoot();
      }
    });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const uid = fbUser?.uid ?? null;
      if (booted) {
        if (uid === lastUid) return;
        const previousUid = lastUid;
        lastUid = uid;
        if (!uid) {
          // Covers sign-outs Firebase performs itself (disabled user, revoked refresh token).
          clearLocalSession();
        } else if (previousUid) {
          queryClient.clear();
        }
        // Sign-in and sign-up flows load /me themselves; fetching here would duplicate it.
        return;
      }
      booted = true;
      lastUid = uid;
      if (optimisticUid) {
        if (uid === optimisticUid) {
          void revalidateSession();
          return;
        }
        // Firebase dropped the stored user while restoring it (revoked, disabled or deleted).
        clearLocalSession();
        if (!fbUser) return;
        setLoading(true);
      }
      if (fbUser) {
        await waitForAuthStoreHydration();
        const cached = useAuthStore.getState().user;
        if (cached?.orgId && cached.userId === fbUser.uid) {
          setUser(cached);
          finishBoot();
          void revalidateSession();
          return;
        }
      }
      try {
        if (!fbUser) {
          setUser(null);
          return;
        }
        await refreshSession();
      } catch {
        setUser(null);
        await auth.signOut().catch(() => undefined);
      } finally {
        setLoading(false);
        finishBoot();
      }
    });
    return () => {
      disposed = true;
      unsub();
    };
  }, []);

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
