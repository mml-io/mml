import * as esbuild from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { dtsPlugin } from "../../../utils/dtsPlugin";
import { rebuildOnDependencyChangesPlugin } from '../../../utils/rebuildOnDependencyChangesPlugin';

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

const args = process.argv.splice(2);

if (args.length !== 1) {
  console.error(helpString);
  process.exit(1);
}

const mode = args[0];

const commonPlugins = [
  ...(mode === watchMode ? [
    rebuildOnDependencyChangesPlugin()
  ] : []),
  copy({
    resolveFrom: 'cwd',
    assets: [
      { from: ['./src/mml.schema.json'], to: ['./build/mml.schema.json'] },
    ],
  }),
];

// ESM build for module imports
const esmBuildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  write: true,
  bundle: true,
  format: "esm",
  outdir: "build",
  platform: "browser",
  sourcemap: true,
  target: "es2020",
  plugins: [
    ...commonPlugins,
    dtsPlugin({
      outDir: "build",
    }),
    // Only need to copy these files once (skipped in UMD)
    copy({
      resolveFrom: 'cwd',
      assets: [
        { from: ['./src/mml.schema.json'], to: ['./build/mml.schema.json'] },
      ],
    }),
  ],
  external: [],
};

// UMD build for direct browser usage
const umdBuildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  write: true,
  bundle: true,
  format: "iife",
  globalName: "MMLMathSystem",
  outfile: "build/index.umd.js",
  platform: "browser",
  sourcemap: true,
  target: "es2020",
  plugins: commonPlugins,
  external: [],
};

async function buildAll() {
  try {
    await Promise.all([
      esbuild.build(esmBuildOptions),
      esbuild.build(umdBuildOptions)
    ]);
    console.log("Built both ESM and UMD formats successfully");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

async function watchAll() {
  try {
    const [esmContext, umdContext] = await Promise.all([
      esbuild.context(esmBuildOptions),
      esbuild.context(umdBuildOptions)
    ]);
    
    await Promise.all([
      esmContext.watch(),
      umdContext.watch()
    ]);
    
    console.log("Watching both ESM and UMD builds...");
  } catch (error) {
    console.error("Watch setup failed:", error);
    process.exit(1);
  }
}

switch (mode) {
  case buildMode:
    buildAll();
    break;
  case watchMode:
    watchAll();
    break;
  default:
    console.error(helpString);
}


