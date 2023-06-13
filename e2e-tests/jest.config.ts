import type { Config } from "jest";

const config: Config = {
  globalSetup: "./setup.ts",
  globalTeardown: "./teardown.ts",
  testEnvironment: "./puppeteer_environment.ts",
  setupFilesAfterEnv: ["./jest.setup.ts"],
  verbose: true,
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest", {}],
  },
};

export default config;
