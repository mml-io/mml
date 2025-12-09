import path from "path";

import type { Argv } from "yargs";

import { DEFAULT_ASSETS_DIR, DEFAULT_EDITOR_PORT, DEFAULT_HOST, DEFAULT_SRC_DIR } from "../config/defaults";
import { watchSingleGame } from "../lib/singleGameBuilder";
import { pathExists } from "../utils/fs";

interface EditorArgs {
  root?: string;
  src?: string;
  assets?: string;
  host?: string;
  port?: number;
}

async function runEditor(argv: EditorArgs): Promise<void> {
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
    watch: true,
    host: argv.host || DEFAULT_HOST,
    port: argv.port || DEFAULT_EDITOR_PORT,
  });
}

export function registerEditorCommand(yargs: Argv): Argv {
  return yargs.command(
    "editor",
    "Start the live editor server (default port 3003)",
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
          default: DEFAULT_HOST,
          describe: "Host to bind (localhost by default)",
        })
        .option("port", {
          type: "number",
          default: DEFAULT_EDITOR_PORT,
          describe: "Port for the editor server",
        }),
    async (argv) => {
      await runEditor({
        root: argv.root as string | undefined,
        games: argv.games as string | undefined,
        assets: argv.assets as string | undefined,
        host: argv.host as string | undefined,
        port: argv.port as number | undefined,
      });
    },
  );
}
