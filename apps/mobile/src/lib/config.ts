import Constants from "expo-constants";
import { useSettingsStore } from "@/store/settings";

/** Default from build-time env / app.config extra. */
export function getDefaultApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra.replace(/\/$/, "");
  return "http://localhost:8080/api/v1";
}

/** Runtime URL — field devices can override in Settings without rebuilding. */
export function getApiBaseUrl(): string {
  const override = useSettingsStore.getState().apiUrlOverride?.trim();
  if (override) return override.replace(/\/$/, "");
  return getDefaultApiUrl();
}
