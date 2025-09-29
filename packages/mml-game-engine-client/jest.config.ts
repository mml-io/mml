import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
  testMatch: ["**/*.test.(ts|tsx)"],
  verbose: true,
  resetModules: true,
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.(mjs|mts|cjs|js|jsx|ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
};
export default jestConfig;
