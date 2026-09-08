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

module.exports = config;
