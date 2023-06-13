import type { Config } from "jest";

const config: Config = {
  verbose: true,
  transform: {
    "^.+\\.(tsx?)$": [
      "esbuild-jest",
      {
        sourcemap: true,
      },
    ],
  },
};

export default config;
