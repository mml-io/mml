import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

let puppeteerModule: any = null;

export async function loadPuppeteer(): Promise<any> {
  if (puppeteerModule) return puppeteerModule;

  // Helper to normalize ESM/CJS shapes (Puppeteer is typically a default export)
  const normalize = (mod: any) => mod?.default ?? mod;

  // First try normal Node resolution relative to this package.
  try {
    puppeteerModule = normalize(await import("puppeteer"));
    return puppeteerModule;
  } catch {
    // Fallback: try resolving from the caller's working directory.
    // This matches the common expectation that `npm i puppeteer` in the project
    // you're running `mml` from should be sufficient.
    try {
      const cwdPackageJson = path.join(process.cwd(), "package.json");
      const cwdRequire = createRequire(pathToFileURL(cwdPackageJson).href);
      const resolvedPath = cwdRequire.resolve("puppeteer");
      puppeteerModule = normalize(await import(pathToFileURL(resolvedPath).href));
      return puppeteerModule;
    } catch {
      throw new Error(
        "Puppeteer is not installed (or can't be resolved from this CLI or your current project).\n" +
          "Install it in the same place you run `mml` from with: npm install puppeteer\n" +
          "Puppeteer is required for screenshot and debug client functionality.",
      );
    }
  }
}
