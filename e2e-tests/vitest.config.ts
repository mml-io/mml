import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./vitest.global-setup.ts",
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks",
    // In vitest 4, poolOptions was removed. Use maxConcurrency for sequential test execution.
    maxConcurrency: 1,
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 30000,
    include: ["test/**/*.test.ts"],
  },
});
