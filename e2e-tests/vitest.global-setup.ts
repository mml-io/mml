import { mkdirSync, writeFileSync } from "node:fs";

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import puppeteer, { Browser } from "puppeteer";

const DIR = path.join(os.tmpdir(), "vitest_puppeteer_global_setup");

let headless = false;
if (process.env.HEADLESS === "true") {
  headless = true;
}

let browser: Browser;

export async function setup() {
  browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      // Disable canvas readback noise to make screenshots deterministic
      "--disable-features=CanvasReadbackNoise,CanvasNoise,CanvasImageDataNoise",
      // Enable software rendering for WebGL in CI environments
      ...(process.env.RENDERER !== "playcanvas"
        ? ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
        : []),
    ],
    headless,
  });

  // Store the browser instance so we can teardown it later
  (globalThis as any).__BROWSER_GLOBAL__ = browser;

  // Use the file system to expose the wsEndpoint for test setup
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path.join(DIR, "wsEndpoint"), browser.wsEndpoint());
}

export async function teardown() {
  // Close the browser instance
  if ((globalThis as any).__BROWSER_GLOBAL__) {
    await (globalThis as any).__BROWSER_GLOBAL__.close();
  }

  // Clean up the wsEndpoint file
  await fs.rm(DIR, { recursive: true, force: true });
}
