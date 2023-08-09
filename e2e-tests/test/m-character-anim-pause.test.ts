import * as puppeteer from "puppeteer";

import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-character", () => {
  test("animation pause", async () => {
    const page = (await globalThis.__BROWSER_GLOBAL__.newPage()) as puppeteer.Page;

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-character-anim-pause-test.html/reset");

    await page.waitForSelector("m-character");

    // Wait until the character is loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (
          (character as any).getCharacter() !== null &&
          (character as any).getCurrentAnimation() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForSelector("m-model");

    // Wait until the model is loaded
    await page.waitForFunction(
      () => {
        const model = document.querySelector("m-model");
        return (model as any).getModel() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
