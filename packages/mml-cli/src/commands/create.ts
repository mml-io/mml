import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import type { Argv } from "yargs";

import { ensureDir, copyDirectory, pathExists, toPackageName } from "../utils/fs";

interface CreateArgs {
  appName: string;
  dir?: string;
  force?: boolean;
}

const currentDirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDirPromise = findTemplatesDir();

async function findTemplatesDir(): Promise<string> {
  const candidates = [
    path.resolve(currentDirname, "..", "templates"),
    path.resolve(currentDirname, "..", "..", "templates"),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

async function writeProjectPackageJson(projectRoot: string, appName: string): Promise<void> {
  const packageJsonPath = path.join(projectRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return;
  }

  const raw = await fs.readFile(packageJsonPath, "utf-8");
  const pkg = JSON.parse(raw);
  const safeName = toPackageName(appName);
  pkg.name = pkg.name === "mml-new-app" ? safeName : pkg.name || safeName;
  await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

async function copyTemplate(projectRoot: string, templateName: string, overwrite: boolean): Promise<void> {
  const templatesDir = await templatesDirPromise;
  const source = path.join(templatesDir, templateName);
  if (!(await pathExists(source))) {
    throw new Error(`Template not found: ${templateName}`);
  }
  await copyDirectory(source, projectRoot, { overwrite });
}

async function createProject(args: CreateArgs): Promise<void> {
  const appName = args.appName;
  const destinationRoot = path.resolve(args.dir || process.cwd(), appName);

  await ensureDir(path.dirname(destinationRoot));
  await ensureDir(destinationRoot, { empty: true, force: Boolean(args.force) });

  await copyTemplate(destinationRoot, "basic", Boolean(args.force));
  await writeProjectPackageJson(destinationRoot, appName);

  console.log(`✅ Created MML project at ${destinationRoot}`);
  console.log("Next steps:");
  console.log(`  cd ${destinationRoot}`);
  console.log("  npm install");
  console.log("  mml editor    # start the editor server (default port 3003)");
  console.log("  mml serve     # start the game server (default port 3004)");
}

export function registerCreateCommand(yargs: Argv): Argv {
  return yargs.command(
    "create <appName>",
    "Create a new MML project with physics + character sample",
    (command) =>
      command
        .positional("appName", {
          describe: "Name of the project directory to create",
          type: "string",
        })
        .option("dir", {
          alias: "d",
          type: "string",
          default: ".",
          describe: "Base directory where the project will be created",
        })
        .option("force", {
          alias: "f",
          type: "boolean",
          default: false,
          describe: "Overwrite the target directory if it already exists",
        })
        .check((argv) => {
          if (!argv.appName || typeof argv.appName !== "string") {
            throw new Error("appName is required");
          }
          return true;
        }),
    async (argv) => {
      await createProject({
        appName: argv.appName as string,
        dir: argv.dir as string | undefined,
        force: argv.force as boolean | undefined,
      });
    },
  );
}
