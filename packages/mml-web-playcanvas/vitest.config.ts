import { TextDecoder, TextEncoder } from "util";
import { defineConfig } from "vitest/config";

// Polyfill TextEncoder/TextDecoder before module loading (needed for jsdom)
Object.assign(globalThis, { TextEncoder, TextDecoder });

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
