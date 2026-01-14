import path from "path";

import type { Argv } from "yargs";

// import { mml, MMLPluginOptions } from "@mml-io/esbuild-plugin-mml";
import { DEFAULT_ASSETS_DIR, DEFAULT_SRC_DIR } from "../config/defaults";
import { bundleSingleProject } from "../lib/projectBundler";
import { buildSingleGame, watchSingleGameBuild } from "../lib/singleGameBuilder";
import { pathExists } from "../utils/fs";

interface BuildArgs {
  root?: string;
  src?: string;
  assets?: string;
  watch?: boolean;
  bundle?: boolean;
  out?: string;
}

async function runBuild(argv: BuildArgs): Promise<void> {
  const root = path.resolve(argv.root || process.cwd());
  const srcDir = path.resolve(root, argv.src || DEFAULT_SRC_DIR);
  const hasSrcDir = await pathExists(srcDir);

  if (argv.bundle) {
    await bundleSingleProject({
      projectRoot: root,
      outDir: argv.out ? path.resolve(root, argv.out) : path.join(root, "dist"),
    });
    return;
  }

  if (!hasSrcDir) {
    throw new Error(`No src directory found at ${srcDir}.`);
  }

  const assetsDir = argv.assets ? path.resolve(root, argv.assets) : path.join(root, DEFAULT_ASSETS_DIR);

  if (argv.watch) {
    await watchSingleGameBuild({
      projectRoot: root,
      srcDir,
      assetsDir,
      outDir: argv.out ? path.resolve(root, argv.out) : undefined,
      watch: true,
    });
    return;
  }

  await buildSingleGame({
    projectRoot: root,
    srcDir,
    assetsDir,
    outDir: argv.out ? path.resolve(root, argv.out) : undefined,
    watch: false,
  });
}

export function registerBuildCommand(yargs: Argv): Argv {
  return yargs.command(
    "build",
    "Build the current MML project (multi-game or single bundle)",
    (command) =>
      command
        .option("root", {
          type: "string",
          describe: "Project root to run from",
        })
        .option("src", {
          type: "string",
          default: DEFAULT_SRC_DIR,
          describe: "Path to the src directory containing main.mml",
        })
        .option("assets", {
          type: "string",
          default: DEFAULT_ASSETS_DIR,
          describe: "Path to assets folder to include when serving",
        })
        .option("watch", {
          type: "boolean",
          default: false,
          describe: "Watch for changes instead of building once",
        })
        .option("bundle", {
          type: "boolean",
          default: false,
          describe: "Use project-bundler to emit a single-file dist build",
        })
        .option("out", {
          type: "string",
          describe: "Output directory when using --bundle",
        }),
    async (argv) => {
      await runBuild({
        root: argv.root as string | undefined,
        src: argv.src as string | undefined,
        assets: argv.assets as string | undefined,
        watch: argv.watch as boolean | undefined,
        bundle: argv.bundle as boolean | undefined,
        out: argv.out as string | undefined,
      });
    },
  );
}
