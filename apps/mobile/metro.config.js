const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Monorepo support: watch the workspace root so shared packages rebuild.
config.watchFolders = [workspaceRoot];

// Prefer the mobile app's node_modules, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Keep symlink resolution for pnpm's .pnpm store.
config.resolver.unstable_enableSymlinks = true;

// The web app uses React 19, which pnpm hoists into node_modules/.pnpm/node_modules.
// Packages that require these without declaring them would otherwise pick up that
// copy, mixing two React versions in one bundle. Always resolve them from this app.
const singletonPackages = ["react", "react-native", "react-dom"];
const appPackageJson = path.resolve(projectRoot, "package.json");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = singletonPackages.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`)
  );
  if (isSingleton && context.originModulePath !== appPackageJson) {
    try {
      return context.resolveRequest(
        { ...context, originModulePath: appPackageJson },
        moduleName,
        platform
      );
    } catch {
      // Not installed for the mobile app (e.g. react-dom); fall back to default lookup.
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Evaluate modules on first use instead of all at startup (React Native's own default;
// Expo turns it off). Imports kept only for side effects are not inlined.
const getDefaultTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const options = getDefaultTransformOptions ? await getDefaultTransformOptions(...args) : {};
  return { ...options, transform: { ...options.transform, inlineRequires: true } };
};

// Treat .txt vendor bundles (pdf.js) as assets so we can read them at runtime.
const { assetExts, sourceExts } = config.resolver;
config.resolver.assetExts = Array.from(new Set([...(assetExts || []), "txt"]));
config.resolver.sourceExts = (sourceExts || []).filter((ext) => ext !== "txt");

module.exports = config;
