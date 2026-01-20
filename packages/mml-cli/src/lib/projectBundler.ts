import fs from "fs/promises";
import { ProjectBundler } from "mml-game-project-bundler";
import path from "path";

import { pathExists } from "../utils/fs";

interface ScriptEntry {
  src: string;
  configName?: string;
  config?: Record<string, unknown>;
}

interface ScriptsJson {
  scripts?: ScriptEntry[];
}

interface BundleArgs {
  projectRoot: string;
  outDir: string;
}

async function loadSystemsFromScriptsJson(
  srcDir: string,
): Promise<Map<string, Record<string, unknown>>> {
  const systems = new Map<string, Record<string, unknown>>();
  const scriptsJsonPath = path.join(srcDir, "scripts.json");

  if (await pathExists(scriptsJsonPath)) {
    const content = await fs.readFile(scriptsJsonPath, "utf-8");
    const scriptsJson: ScriptsJson = JSON.parse(content);

    for (const entry of scriptsJson.scripts ?? []) {
      // Extract system name from src (e.g., "mml-game-physics-system" -> "physics")
      const systemName = entry.configName ?? entry.src.replace(/^mml-game-|-system$/g, "");
      systems.set(systemName, entry.config ?? {});
    }
  } else {
    // Fallback: default systems if no scripts.json
    systems.set("physics", {});
    systems.set("math", {});
  }

  return systems;
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
    files["script.ts"] = await fs.readFile(scriptPathTs, "utf-8");
  } else if (await pathExists(scriptPathJs)) {
    files["script.js"] = await fs.readFile(scriptPathJs, "utf-8");
  } else {
    files["script.js"] = "";
  }

  const systems = await loadSystemsFromScriptsJson(srcDir);

  const result = await ProjectBundler.bundleProject(files, systems);

  await fs.mkdir(options.outDir, { recursive: true });
  await fs.writeFile(path.join(options.outDir, "index.html"), result.combined, "utf-8");
  await fs.writeFile(path.join(options.outDir, "scene.mml"), result.html, "utf-8");
  await fs.writeFile(path.join(options.outDir, "scripts.js"), result.userScripts, "utf-8");
  await fs.writeFile(path.join(options.outDir, "systems.js"), result.systemScripts, "utf-8");

  console.log(`📦 Single-file bundle written to ${options.outDir}`);
}
