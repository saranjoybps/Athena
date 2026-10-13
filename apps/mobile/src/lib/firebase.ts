import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let auth: Auth | null = null;

export function firebaseAuth(): Auth | null {
  if (!config.apiKey || !config.projectId) return null;
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(config);
  try {
    // RN persistence — imported dynamically to avoid web-only typing issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require("firebase/auth");
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
  return auth;
}

/**
 * uid of the user Firebase persisted for this app, read straight from storage.
 * Firebase only reports auth state after a network reload of that user, so this
 * lets boot open a matching cached session without waiting on the network.
 */
export async function getPersistedFirebaseUid(): Promise<string | null> {
  if (!config.apiKey) return null;
  try {
    const raw = await AsyncStorage.getItem(`firebase:authUser:${config.apiKey}:[DEFAULT]`);
    const uid = raw ? (JSON.parse(raw) as { uid?: unknown }).uid : null;
    return typeof uid === "string" ? uid : null;
  } catch {
    return null;
  }
}

/** Wait for RN Firebase persistence to restore before reading currentUser. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = firebaseAuth();
  if (!auth) return null;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
