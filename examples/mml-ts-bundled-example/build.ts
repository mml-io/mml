import * as esbuild from "esbuild";

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error(helpString);
  process.exit(1);
}

const mode = args[0];

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  write: true,
  bundle: true,
  format: "iife",
  outdir: "build",
  platform: "browser",
  sourcemap: true,
  target: "es2020",
  define: {
    global: "globalThis",
  },
};

switch (mode) {
  case buildMode:
    esbuild.build(buildOptions).catch((e) => {
      console.error(e);
      process.exit(1);
    });
    break;
  case watchMode:
    esbuild
      .context({ ...buildOptions })
      .then((context) => context.watch())
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
    break;
  default:
    console.error(helpString);
}
