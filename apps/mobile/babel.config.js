module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: { "@": "./src" },
        },
      ],
      "./babel-plugin-lucide-imports",
      "react-native-reanimated/plugin",
    ],
  };
};
