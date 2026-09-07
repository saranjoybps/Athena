import type { ConfigContext, ExpoConfig } from "expo/config";

const VERSION = "0.2.0";
const VERSION_CODE = 2;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Athena",
  slug: "athena",
  version: VERSION,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "athena",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#f5f0e8",
  },
  android: {
    package: "io.athena.app",
    versionCode: VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#f5f0e8",
    },
    permissions: ["INTERNET", "ACCESS_NETWORK_STATE", "VIBRATE"],
    softwareKeyboardLayoutMode: "pan",
    // Field APKs often hit LAN / HTTP API hosts during pilots.
    // Expo Android config supports this at build time.
    ...({ usesCleartextTraffic: true } as Record<string, unknown>),
  },
  ios: {
    bundleIdentifier: "io.athena.app",
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: (process.env as Record<string, string | undefined>).EAS_PROJECT_ID,
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api/v1",
  },
});
