import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { Argv } from "yargs";

import { copyDirectory, ensureDir, pathExists, toPackageName } from "../utils/fs";

interface CreateArgs {
  appName: string;
  dir?: string;
  force?: boolean;
}

const currentDirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDirPromise = findTemplatesDir();

async function findLocalEngineRootFromCliDir(cliDir: string): Promise<string | null> {
  let dir = cliDir;
  // Walk up looking for this monorepo layout:
  // <root>/packages/mml-cli and <root>/packages/systems
  for (;;) {
    const rootCliDir = path.join(dir, "packages", "mml-cli");
    const systemsDir = path.join(dir, "packages", "systems");
    const lernaJson = path.join(dir, "lerna.json");

    const isOurMonorepoRoot =
      (cliDir === rootCliDir || cliDir.startsWith(rootCliDir + path.sep)) &&
      (await pathExists(rootCliDir)) &&
      (await pathExists(systemsDir)) &&
      (await pathExists(lernaJson));

    if (isOurMonorepoRoot) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

async function getLocalSystemPackageNameToDirMap(engineRoot: string): Promise<Map<string, string>> {
  const systemsDir = path.join(engineRoot, "packages", "systems");
  if (!(await pathExists(systemsDir))) {
    return new Map();
  }

  const entries = await fs.readdir(systemsDir, { withFileTypes: true });
  const nameToDir = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pkgJsonPath = path.join(systemsDir, entry.name, "package.json");
    if (!(await pathExists(pkgJsonPath))) {
      continue;
    }
    const raw = await fs.readFile(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(raw);
    const name = pkg?.name;
    if (typeof name === "string" && name.length > 0) {
      nameToDir.set(name, path.join(systemsDir, entry.name));
    }
  }

  return nameToDir;
}

function toFileDependency(fromProjectRoot: string, targetDir: string): string {
  let rel = path.relative(fromProjectRoot, targetDir);
  if (!rel.startsWith(".")) {
    rel = `.${path.sep}${rel}`;
  }
  // npm accepts platform paths, but normalizing avoids surprises in config files/logs.
  const normalized = rel.split(path.sep).join("/");
  return `file:${normalized}`;
}

async function rewriteSystemDependenciesToLocalIfAvailable(projectRoot: string): Promise<boolean> {
  const engineRoot = await findLocalEngineRootFromCliDir(currentDirname);
  if (!engineRoot) {
    return false;
  }

  const localSystems = await getLocalSystemPackageNameToDirMap(engineRoot);
  if (localSystems.size === 0) {
    return false;
  }

  const packageJsonPath = path.join(projectRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return false;
  }

  const raw = await fs.readFile(packageJsonPath, "utf-8");
  const pkg = JSON.parse(raw);

  let changed = false;
  const depSections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const;
  for (const section of depSections) {
    const deps = pkg?.[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }
    for (const [depName] of Object.entries(deps)) {
      const localDir = localSystems.get(depName);
      if (!localDir) {
        continue;
      }
      deps[depName] = toFileDependency(projectRoot, localDir);
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  return true;
}

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

async function copyTemplate(
  projectRoot: string,
  templateName: string,
  overwrite: boolean,
): Promise<void> {
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
  const usedLocalSystems = await rewriteSystemDependenciesToLocalIfAvailable(destinationRoot);

  console.log(`✅ Created MML project at ${destinationRoot}`);
  console.log("Next steps:");
  console.log(`  cd ${destinationRoot}`);
  console.log("  npm install");
  console.log(
    "  mml dev       # runner UI at / and game server at /server/ (default http://0.0.0.0:3004)",
  );
  console.log("              # (optional) localhost only: mml dev --host localhost");
  if (usedLocalSystems) {
    console.log(
      "              # using local systems from your mml-game-engine checkout (file: deps)",
    );
  }
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
