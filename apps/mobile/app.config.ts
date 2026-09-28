import type { ConfigContext, ExpoConfig } from "expo/config";

const VERSION = "0.2.1";
const VERSION_CODE = 3;

/** Cleartext only when explicitly enabled (preview/LAN pilots). Production must stay HTTPS-only. */
const allowCleartext = process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "true";

const privacyPolicyUrl =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
  "https://athena-api-beta.vercel.app/privacy";

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
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
    softwareKeyboardLayoutMode: "pan",
    ...(allowCleartext ? ({ usesCleartextTraffic: true } as Record<string, unknown>) : {}),
  },
  ios: {
    bundleIdentifier: "io.athena.app",
    supportsTablet: true,
    infoPlist: {
      CFBundleDisplayName: "Athena",
      NSLocationWhenInUseUsageDescription:
        "Athena uses your location to fill the site maps link.",
      NSPhotoLibraryUsageDescription: "Athena uses photos for site proof uploads.",
      ...(allowCleartext
        ? {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: true,
            },
          }
        : {}),
    },
  },
  plugins: [
    "expo-router",
    "expo-asset",
    [
      "expo-build-properties",
      {
        android: {
          // Google Play (from 31 Aug 2026): new apps/updates must target API 36.
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          // Keep minSdk aligned with Expo 52 defaults unless you need lower.
        },
      },
    ],
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
    privacyPolicyUrl,
    allowApiOverride: process.env.EXPO_PUBLIC_ALLOW_API_OVERRIDE === "true",
    cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
    cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "Athena",
  },
});
