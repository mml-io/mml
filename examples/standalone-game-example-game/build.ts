import * as esbuild from "esbuild"
import { rebuildOnDependencyChangesPlugin } from "../../utils/rebuildOnDependencyChangesPlugin";
import { mmlGameEngineBuildPlugin } from "@mml-io/mml-game-engine-build-plugin";

const buildMode = "--build"
const watchMode = "--watch"

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`

const args = process.argv.splice(2)

if (args.length !== 1) {
  console.error(helpString)
  process.exit(1)
}

const mode = args[0]

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  entryNames: "[dir]/[name]-[hash]",
  assetNames: "[dir]/[name]-[hash]",
  bundle: true,
  minify: mode === buildMode,
  outdir: "./build",
  metafile: true,
  sourcemap: "inline",
  publicPath: "/",
  platform: "browser",
  target: "es2020",
  loader: {
    ".png": "file",
    ".jpg": "file",
    ".jpeg": "file",
    ".gif": "file",
    ".svg": "file",
    ".glb": "file",
    ".hdr": "file",
    ".mml": "text",
    ".html": "text",
  },
  plugins: [
    ...(mode === watchMode ? [
      rebuildOnDependencyChangesPlugin(),
    ] : []),
    mmlGameEngineBuildPlugin({
      configPath: "./src/scripts.json",
      htmlTemplate: "./src/index.mml",
      filename: "index.html",
    }),
  ],
}

switch (mode) {
  case buildMode:
    esbuild.build(buildOptions).catch(() => process.exit(1))
    break
  case watchMode:
    esbuild
      .context({
        ...buildOptions,
        plugins: [
          ...buildOptions.plugins!,
        ],
      })
      .then((context) => {
        context.watch()
      })
      .catch(() => process.exit(1))
    break
  default:
    console.error(helpString)
}
