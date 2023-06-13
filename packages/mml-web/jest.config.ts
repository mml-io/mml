import type { Config } from "jest";

const config: Config = {
  verbose: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["lcov", "text"],


  setupFilesAfterEnv: ["jest-expect-message", "./test/jest.setup.ts"],

    "^.+\\.(t|j)sx?$": ["@swc/jest", {}],






export default config;
