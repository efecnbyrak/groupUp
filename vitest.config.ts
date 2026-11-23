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
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          exclude: ["tests/e2e/**", "node_modules/**"],
        },
      },
      {
        // groupup_test DB'sinde servis testleri (önce: npm run db:test:migrate). Dosyalar sırayla çalışır.
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
    ],
  },
});
