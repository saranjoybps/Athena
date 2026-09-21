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
    backgroundColor: "#000000",
  },
  android: {
    package: "io.athena.app",
    label: "Athena",
    versionCode: VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "VIBRATE",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
    ],
    softwareKeyboardLayoutMode: "pan",
    // Field APKs often hit LAN / HTTP API hosts during pilots.
    // Expo Android config supports this at build time.
    ...({ usesCleartextTraffic: true } as Record<string, unknown>),
  },
  ios: {
    bundleIdentifier: "io.athena.app",
    supportsTablet: true,
    infoPlist: {
      CFBundleDisplayName: "Athena",
      NSLocationWhenInUseUsageDescription:
        "Athena uses your location to fill the site maps link.",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Allow Athena to use your location for site maps.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Athena to upload site proof photos.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: (process.env as Record<string, string | undefined>).EAS_PROJECT_ID,
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api/v1",
    cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
    cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "Athena",
  },
});
