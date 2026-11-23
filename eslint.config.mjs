import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * Modül sınırları — docs/ARCHITECTURE.md §5, CLAUDE.md §4.
 *  app            → modül (yalnızca index.ts), lib, ui, i18n
 *  module         → kendi modülü, başka modülün yalnızca index.ts'i, lib, ui, i18n
 *  module-domain  → yalnızca kendi modülünün domain/ dosyaları (saf TS)
 *  lib            → lib (+ prisma/generated)
 *  ui / i18n      → kendisi + lib
 * Sıra önemli: ilk eşleşen tip kazanır (domain, module'den önce).
 */
const elements = [
  { type: "module-domain", pattern: "src/modules/*/domain/**", partialMatch: false, capture: ["mod"] },
  { type: "module", pattern: "src/modules/*/**", partialMatch: false, capture: ["mod"] },
  { type: "lib", pattern: "src/lib/**", partialMatch: false },
  { type: "ui", pattern: "src/components/ui/**", partialMatch: false },
  { type: "i18n", pattern: "src/i18n/**", partialMatch: false },
  { type: "app", pattern: "app/**", partialMatch: false },
  { type: "prisma-client", pattern: "prisma/generated/**", partialMatch: false },
  { type: "tooling", pattern: "{prisma,scripts,tests}/**", partialMatch: false },
];

const sameModule = { captured: { mod: "{{ from.element.captured.mod }}" } };
// Element deseni dosyanın tamamını eşlediğinden fileInternalPath proje köküne göre tam yoldur.
const moduleEntry = { type: "module", fileInternalPath: "src/modules/*/index.ts" };

const boundaryRules = defineConfig({
  files: ["**/*.{ts,tsx,mts}"],
  plugins: { boundaries },
  settings: {
    "boundaries/elements": elements,
    "boundaries/include": ["app/**", "src/**", "prisma/**", "scripts/**", "tests/**"],
    "import/resolver": { typescript: { alwaysTryTypes: true } },
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        message:
          "Sınır ihlali: {{ from.element.type }} → {{ to.element.type }} yasak (docs/ARCHITECTURE.md §5). Başka modüle yalnızca @/modules/<ad> (index.ts) üzerinden erişin.",
        policies: [
          {
            from: { element: { type: "app" } },
            allow: { to: { element: [moduleEntry, { types: ["lib", "ui", "i18n", "app"] }] } },
          },
          {
            from: { element: { type: "module" } },
            allow: {
              to: {
                element: [
                  { type: "module", ...sameModule },
                  { type: "module-domain", ...sameModule },
                  moduleEntry,
                  { types: ["lib", "ui", "i18n"] },
                ],
              },
            },
          },
          {
            from: { element: { type: "module-domain" } },
            allow: { to: { element: { type: "module-domain", ...sameModule } } },
          },
          {
            from: { element: { type: "lib" } },
            allow: { to: { element: { types: ["lib", "prisma-client"] } } },
          },
          { from: { element: { type: "ui" } }, allow: { to: { element: { types: ["ui", "lib"] } } } },
          { from: { element: { type: "i18n" } }, allow: { to: { element: { types: ["i18n", "lib"] } } } },
          {
            from: { element: { type: "tooling" } },
            allow: { to: { element: [moduleEntry, { types: ["lib", "tooling", "prisma-client"] }] } },
          },
        ],
      },
    ],
  },
});

/** domain/ saf TypeScript: framework, Prisma, React ve sunucu altyapısı yasak. */
const pureDomain = defineConfig({
  files: ["src/modules/*/domain/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@prisma/*", "next", "next/*", "react", "react/*", "react-dom", "server-only", "@/lib/*", "@/modules/*"],
            message: "domain/ saf TS olmalı (CLAUDE.md §4 kural 3).",
          },
        ],
      },
    ],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaryRules,
  ...pureDomain,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "prisma/generated/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
