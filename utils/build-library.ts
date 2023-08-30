import * as esbuild from "esbuild";

import { dtsPlugin } from "./dtsPlugin";

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

export function handleLibraryBuild(
  plugins: Array<esbuild.Plugin> = [],
  loader: { [key: string]: esbuild.Loader } = {},
) {
  const args = process.argv.splice(2);

  if (args.length !== 1) {
    console.error(helpString);
    process.exit(1);
  }

  const mode = args[0];

  const buildOptions: esbuild.BuildOptions = {
    entryPoints: ["src/index.ts"],
    write: true,
    bundle: true,
    format: "esm",
    outdir: "build",
    platform: "node",
    packages: "external",
    sourcemap: true,
    target: "node14",
    loader: {
      ...loader,
    },
    plugins: [...plugins, dtsPlugin()],
  };

  switch (mode) {
    case buildMode:
      esbuild.build(buildOptions).catch(() => process.exit(1));
      break;
    case watchMode:
      esbuild
        .context({ ...buildOptions })
        .then((context) => context.watch())
        .catch(() => process.exit(1));
      break;
    default:
      console.error(helpString);
  }
}
