import Constants from "expo-constants";
import { useSettingsStore } from "@/store/settings";

/** Default from build-time env / app.config extra. */
export function getDefaultApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra.replace(/\/$/, "");
  return "https://athena-api-beta.vercel.app/api/v1";
}

/** True when field devices may override API URL (dev / explicit preview flag). */
export function isApiOverrideAllowed(): boolean {
  if (__DEV__) return true;
  return Constants.expoConfig?.extra?.allowApiOverride === true;
}

export function getPrivacyPolicyUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  if (fromEnv) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.privacyPolicyUrl;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra;
  return "https://athena-api-beta.vercel.app/privacy";
}

/** Runtime URL — field devices can override in Settings when allowed. */
export function getApiBaseUrl(): string {
  if (isApiOverrideAllowed()) {
    const override = useSettingsStore.getState().apiUrlOverride?.trim();
    if (override) return override.replace(/\/$/, "");
  }
  return getDefaultApiUrl();
}
