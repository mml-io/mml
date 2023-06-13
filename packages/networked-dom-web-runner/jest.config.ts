import type { Config } from "jest";

const config: Config = {
  verbose: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["lcov", "text"],
  testEnvironment: "node",
  setupFiles: ["jest-canvas-mock"],
  setupFilesAfterEnv: ["jest-expect-message"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest", {}],
  },
  // allow Jest to transform files in node_modules (required so that exports
  // from THREE's examples folder can be imported)
  transformIgnorePatterns: [],
};

export default config;
