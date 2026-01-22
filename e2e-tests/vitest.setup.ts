import { readFileSync } from "node:fs";

import os from "os";
import path from "path";
import puppeteer, { Browser } from "puppeteer";
import { afterAll, beforeAll, expect } from "vitest";

import { toMatchImageSnapshot } from "./test/image-snapshot";

const DIR = path.join(os.tmpdir(), "vitest_puppeteer_global_setup");

declare global {
  var __BROWSER_GLOBAL__: Browser;
}

// Extend expect with custom matcher
expect.extend({ toMatchImageSnapshot });

beforeAll(async () => {
  const wsEndpoint = readFileSync(path.join(DIR, "wsEndpoint"), { encoding: "utf8" });
  if (!wsEndpoint) {
    throw new Error("wsEndpoint not found");
  }
  globalThis.__BROWSER_GLOBAL__ = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
  });
});

afterAll(() => {
  if (globalThis.__BROWSER_GLOBAL__) {
    globalThis.__BROWSER_GLOBAL__.disconnect();
  }
});
