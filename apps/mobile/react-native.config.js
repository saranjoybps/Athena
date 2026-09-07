// Ensure Expo Modules package uses the real Kotlin package (expo.modules),
// not the Android namespace (expo.core) — needed for local APK builds in this monorepo.
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
