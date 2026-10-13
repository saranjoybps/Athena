const fs = require("fs");
const path = require("path");

// lucide-react-native's entry re-exports ~1,500 icon modules and Metro does not tree-shake,
// so one named import bundles every icon. Point each named icon import at its own module.
// Names that are not icons (createLucideIcon, Icon, types) keep the original import.
function loadIconModules() {
  const pkgDir = path.dirname(require.resolve("lucide-react-native/package.json", { paths: [__dirname] }));
  const entry = fs.readFileSync(path.join(pkgDir, "dist/esm/lucide-react-native.js"), "utf8");
  const modules = new Map();
  for (const [, names, file] of entry.matchAll(/export \{([^}]+)\} from '\.\/icons\/([\w-]+)\.js';/g)) {
    for (const spec of names.split(",")) {
      const match = spec.trim().match(/^default as (\w+)$/);
      if (match) modules.set(match[1], `lucide-react-native/dist/esm/icons/${file}.js`);
    }
  }
  return modules;
}

module.exports = function lucideImports({ types: t }) {
  const iconModules = loadIconModules();
  return {
    name: "lucide-imports",
    visitor: {
      ImportDeclaration(importPath) {
        const { node } = importPath;
        if (node.source.value !== "lucide-react-native" || node.importKind === "type") return;
        const kept = [];
        const rewritten = [];
        for (const spec of node.specifiers) {
          const imported =
            spec.type === "ImportSpecifier" && spec.importKind !== "type"
              ? spec.imported.name ?? spec.imported.value
              : undefined;
          const target = imported ? iconModules.get(imported) : undefined;
          if (target) {
            rewritten.push(
              t.importDeclaration([t.importDefaultSpecifier(t.identifier(spec.local.name))], t.stringLiteral(target))
            );
          } else {
            kept.push(spec);
          }
        }
        if (rewritten.length === 0) return;
        if (kept.length === 0) {
          importPath.replaceWithMultiple(rewritten);
        } else {
          node.specifiers = kept;
          importPath.insertAfter(rewritten);
        }
      },
    },
  };
};
