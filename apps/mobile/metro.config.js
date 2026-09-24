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

// Treat .txt vendor bundles (pdf.js) as assets so we can read them at runtime.
const { assetExts, sourceExts } = config.resolver;
config.resolver.assetExts = Array.from(new Set([...(assetExts || []), "txt"]));
config.resolver.sourceExts = (sourceExts || []).filter((ext) => ext !== "txt");

module.exports = config;
