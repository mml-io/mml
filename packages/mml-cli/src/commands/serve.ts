import path from "path";

import type { Argv } from "yargs";

import {
  DEFAULT_ASSETS_DIR,
  DEFAULT_LAN_HOST,
  DEFAULT_SERVE_PORT,
  DEFAULT_SRC_DIR,
} from "../config/defaults";
import { watchSingleGame } from "../lib/singleGameBuilder";
import { pathExists } from "../utils/fs";

interface DevArgs {
  root?: string;
  src?: string;
  assets?: string;
  host?: string;
  port?: number;
  watch?: boolean;
}

async function runDev(argv: DevArgs): Promise<void> {
  const root = path.resolve(argv.root || process.cwd());
  const srcDir = path.resolve(root, argv.src || DEFAULT_SRC_DIR);

  if (!(await pathExists(srcDir))) {
    throw new Error(`src directory not found at ${srcDir}.`);
  }

  const assetsDir = argv.assets ? path.resolve(root, argv.assets) : path.join(root, DEFAULT_ASSETS_DIR);

  await watchSingleGame({
    projectRoot: root,
    srcDir,
    assetsDir,
    outDir: undefined,
    watch: argv.watch !== false,
    host: argv.host || DEFAULT_LAN_HOST,
    port: argv.port || DEFAULT_SERVE_PORT,
  });
}

export function registerDevCommand(yargs: Argv): Argv {
  return yargs.command(
    "dev",
    "Run the dev server for local or LAN devices",
    (command) =>
      command
        .option("root", {
          type: "string",
          describe: "Project root to run from",
        })
        .option("src", {
          type: "string",
          default: DEFAULT_SRC_DIR,
          describe: "Path to src directory containing main.mml",
        })
        .option("assets", {
          type: "string",
          default: DEFAULT_ASSETS_DIR,
          describe: "Assets directory to serve at /assets",
        })
        .option("host", {
          type: "string",
          default: DEFAULT_LAN_HOST,
          describe: "Host to bind (0.0.0.0 recommended for devices)",
        })
        .option("port", {
          type: "number",
          default: DEFAULT_SERVE_PORT,
          describe: "Port for the game server",
        })
        .option("no-watch", {
          type: "boolean",
          default: false,
          describe: "Build once then serve without watch",
        }),
    async (argv) => {
      await runDev({
        root: argv.root as string | undefined,
        src: argv.src as string | undefined,
        assets: argv.assets as string | undefined,
        host: argv.host as string | undefined,
        port: argv.port as number | undefined,
        watch: !(argv["no-watch"] as boolean),
      });
    },
  );
}
