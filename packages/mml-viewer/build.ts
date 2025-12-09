import * as esbuild from "esbuild";
import cssModulesPlugin from "esbuild-css-modules-plugin";
import { copy } from "esbuild-plugin-copy";
import * as process from "process";

const buildMode = "--build";
const serveMode = "--serve";

const helpString = `Mode must be provided as one of ${buildMode} or ${serveMode}`;

const args = process.argv.splice(2);
if (args.length !== 1) {
  console.error(helpString);
  process.exit(1);
}
const mode = args[0];

const buildOptions: esbuild.BuildOptions = {
  entryPoints: {
    index: "src/index.ts",
  },
  bundle: true,
  external: ["node:crypto", "node:worker_threads"],
  write: true,
  metafile: true,
  publicPath: "",
  sourcemap: true,
  minify: true,
  assetNames: "[name]-[hash]",
  preserveSymlinks: true,
  outdir: "./build/",
  splitting: true,
  platform: "browser",
  format: "esm",
  loader: {
    ".svg": "file",
    ".png": "file",
    ".jpg": "file",
    ".css": "css",
  },
  plugins: [
    cssModulesPlugin({}),
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["./src/static/**/*"],
        to: ["./build/"],
      },
    }),
  ],
};

switch (mode) {
  case buildMode:
    esbuild.build(buildOptions).catch(() => process.exit(1));
    break;
  case serveMode:
    // eslint-disable-next-line no-case-declarations
    const portArg = process.env.PORT;
    if (!portArg) {
      console.error("PORT environment variable is not set for server");
      process.exit(1);
    }
    esbuild
      .context({ ...buildOptions })
      .then((context) =>
        context.serve({
          host: "127.0.0.1",
          port: parseInt(portArg, 10),
          servedir: "./build/",
        }),
      )
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
    break;
  default:
    console.error(helpString);
    process.exit(1);
}
