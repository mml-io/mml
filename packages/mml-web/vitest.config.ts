import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      reportsDirectory: "coverage",
    },
    setupFiles: ["vitest-canvas-mock", "../../test-utils/vitest-browser-polyfills.ts"],
  },
});
