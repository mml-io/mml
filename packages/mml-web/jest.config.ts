import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  verbose: true,
  collectCoverage: true,
  testEnvironment: "jsdom",
  coverageDirectory: "coverage",
  coverageReporters: ["lcov", "text"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "esbuild-embed-draco-decoder-wasm": "<rootDir>/test/stubs/StubDRACODecoderWASM.js",
    "esbuild-embed-draco-wasm-wrapper-js": "<rootDir>/test/stubs/StubDRACOWASMWrapper.js",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["jest-canvas-mock"],
  setupFilesAfterEnv: ["jest-expect-message", "../../test-utils/jest-browser-polyfills.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
};

export default jestConfig;
