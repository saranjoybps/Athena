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

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth()?.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
