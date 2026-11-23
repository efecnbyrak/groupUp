import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/app\/(.*)$/, replacement: r("./app/$1") },
      { find: /^@\/(.*)$/, replacement: r("./src/$1") },
      // server-only, test ortamında (react-server koşulu yok) boş modül olarak çözülür.
      { find: /^server-only$/, replacement: r("./tests/stubs/server-only.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
