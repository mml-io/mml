import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  verbose: true,
  collectCoverage: true,
  testEnvironment: "node",
  coverageDirectory: "coverage",
  coverageReporters: ["lcov", "text"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFilesAfterEnv: ["jest-expect-message"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
    // Support loading yaml files as text
    ".yaml$": "<rootDir>/test/textTransformer.cjs",
  },
};

export default jestConfig;
