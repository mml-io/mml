import fs from "fs/promises";
import path from "path";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(
  targetPath: string,
  options: { empty?: boolean; force?: boolean } = {},
): Promise<void> {
  const { empty = false, force = false } = options;
  const exists = await pathExists(targetPath);
  if (!exists) {
    await fs.mkdir(targetPath, { recursive: true });
    return;
  }

  if (empty) {
    const entries = await fs.readdir(targetPath);
    if (entries.length > 0 && !force) {
      throw new Error(
        `Directory "${targetPath}" is not empty. Use --force to overwrite or choose another path.`,
      );
    }
  }
}

export async function copyDirectory(
  source: string,
  destination: string,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: options.overwrite === true });
}

export function toPackageName(appName: string): string {
  const normalized = appName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return normalized || "mml-app";
}
