import fs from "fs/promises";
import path from "path";

import { ProjectBundler } from "mml-game-project-bundler";

import { pathExists } from "../utils/fs";

interface BundleArgs {
  projectRoot: string;
  outDir: string;
}

export async function bundleSingleProject(options: BundleArgs): Promise<void> {
  const srcDir = path.join(options.projectRoot, "src");
  const mmlPath = path.join(srcDir, "main.mml");
  const scriptPathTs = path.join(srcDir, "main.ts");
  const scriptPathJs = path.join(srcDir, "main.js");

  if (!(await pathExists(mmlPath))) {
    throw new Error(`main.mml not found at ${mmlPath}`);
  }

  const files: Record<string, string> = {
    "scene.mml": await fs.readFile(mmlPath, "utf-8"),
  };

  if (await pathExists(scriptPathTs)) {
    files["script.js"] = await fs.readFile(scriptPathTs, "utf-8");
  } else if (await pathExists(scriptPathJs)) {
    files["script.js"] = await fs.readFile(scriptPathJs, "utf-8");
  } else {
    files["script.js"] = "";
  }

  // Default systems: physics + math to match the starter template
  const systems = new Map<string, Record<string, unknown>>();
  systems.set("physics", {});
  systems.set("math", {});

  const result = await ProjectBundler.bundleProject(files, systems);

  await fs.mkdir(options.outDir, { recursive: true });
  await fs.writeFile(path.join(options.outDir, "index.html"), result.combined, "utf-8");
  await fs.writeFile(path.join(options.outDir, "scene.mml"), result.html, "utf-8");
  await fs.writeFile(path.join(options.outDir, "scripts.js"), result.userScripts, "utf-8");
  await fs.writeFile(path.join(options.outDir, "systems.js"), result.systemScripts, "utf-8");

  console.log(`📦 Single-file bundle written to ${options.outDir}`);
}
