import path from "node:path";

import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@mml-io/networked-dom-server": path.resolve(repoRoot, "packages/networked-dom-server/src/index.ts"),
      "@mml-io/networked-dom-document": path.resolve(repoRoot, "packages/networked-dom-document/src/index.ts"),
      "@mml-io/observable-dom-common": path.resolve(
        repoRoot,
        "packages/observable-dom-common/src/index.ts",
      ),
      "@mml-io/observable-dom": path.resolve(repoRoot, "packages/observable-dom/src/index.ts"),
      "@mml-io/networked-dom-protocol": path.resolve(
        repoRoot,
        "packages/networked-dom-protocol/src/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      reportsDirectory: "coverage",
    },
  },
});
