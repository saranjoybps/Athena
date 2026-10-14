import Constants from "expo-constants";

/** API base URL baked in at build time (`EXPO_PUBLIC_API_URL` / app.config extra). */
export function getDefaultApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra.replace(/\/$/, "");
  return "https://athena-gray.vercel.app/api/v1";
}

export function getPrivacyPolicyUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  if (fromEnv) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.privacyPolicyUrl;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra;
  return "https://athena-gray.vercel.app/privacy";
}

export function getApiBaseUrl(): string {
  return getDefaultApiUrl();
}
