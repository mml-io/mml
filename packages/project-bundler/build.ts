import * as esbuild from "esbuild";
import { base64Plugin } from "../../utils/base64plugin";
import { dtsPlugin } from "../../utils/dtsPlugin";
import { textPlugin } from "../../utils/textPlugin";

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

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
  outbase: "./src",
  platform: "node",
  packages: "external",
  sourcemap: true,
  target: "esnext",
  plugins: [
    dtsPlugin(),
    textPlugin(),
    base64Plugin(),
  ],
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
