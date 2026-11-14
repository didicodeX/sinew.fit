import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "src/__mocks__/server-only.ts") },
      { find: "@domain", replacement: path.resolve(__dirname, "src/domain") },
      { find: "@features", replacement: path.resolve(__dirname, "src/features") },
      { find: "@lib", replacement: path.resolve(__dirname, "src/lib") },
      { find: "@shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
