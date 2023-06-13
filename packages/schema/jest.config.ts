import type { Config } from "jest";

const config: Config = {
  verbose: true,
  transform: {
    "^.+\\.(tsx?)|(xsd)$": [
      "esbuild-jest",
      {
        sourcemap: true,
        loaders: {
          ".xsd": "text",
        },
      },
    ],
  },
};

export default config;
