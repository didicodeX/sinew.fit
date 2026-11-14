import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(import.meta.dirname, "src/__mocks__/server-only.ts") },
      { find: "@domain", replacement: path.resolve(import.meta.dirname, "src/domain") },
      { find: "@features", replacement: path.resolve(import.meta.dirname, "src/features") },
      { find: "@lib", replacement: path.resolve(import.meta.dirname, "src/lib") },
      { find: "@shared", replacement: path.resolve(import.meta.dirname, "src/shared") },
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Keep memory use low (dev server + IDE often run alongside)
    maxWorkers: 2,
  },
});
