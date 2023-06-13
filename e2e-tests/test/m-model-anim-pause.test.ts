import * as puppeteer from "puppeteer";

import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-model", () => {
  test("animation pause", async () => {
    const page = (await globalThis.__BROWSER_GLOBAL__.newPage()) as puppeteer.Page;

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:8079/m-model-anim-pause-test.html/reset");

    await page.waitForSelector("m-model");

    // Wait until the model is loaded
    await page.waitForFunction(
      () => {
        const model = document.querySelector("m-model");
        return (model as any).getModel() !== null;
      },
      { timeout: 5000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
