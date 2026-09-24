import type { ConfigContext, ExpoConfig } from "expo/config";

const VERSION = "0.2.0";
const VERSION_CODE = 2;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Athena",
  slug: "athena",
  owner: "saranjoybpss-team",
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
    "expo-asset",
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
      projectId: "44b68b44-fc8d-442a-8470-0bcb95738a37",
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://athena-api-beta.vercel.app/api/v1",
    cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
    cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "Athena",
  },
});
