import { mkdirSync, writeFileSync } from "node:fs";

import os from "os";
import path from "path";
import puppeteer from "puppeteer";

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

let headless = false;
if (process.env.HEADLESS === "true") {
  headless = true;
}

module.exports = async function () {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
    headless: headless ? "shell" : false,
  });
  // store the browser instance so we can teardown it later
  // this global is only available in the teardown but not in TestEnvironments
  (globalThis as any).__BROWSER_GLOBAL__ = browser;

  // use the file system to expose the wsEndpoint for TestEnvironments
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path.join(DIR, "wsEndpoint"), browser.wsEndpoint());
};
