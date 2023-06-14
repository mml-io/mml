import * as puppeteer from "puppeteer";

import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-interaction", () => {
  test("visible and clickable", async () => {
    const page = (await globalThis.__BROWSER_GLOBAL__.newPage()) as puppeteer.Page;

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:8079/m-interaction-test.html/reset");

    await page.waitForSelector("m-plane[color='yellow']");

    await page.waitForSelector("m-interaction");

    await takeAndCompareScreenshot(page, 0.01);

    await clickElement(page, "m-cube");

    await page.waitForSelector("m-interaction[range='25']");

    await takeAndCompareScreenshot(page, 0.01);

    await clickElement(page, "m-sphere");

    await takeAndCompareScreenshot(page, 0.01);

    await page.waitForSelector("div[data-test-id='interactions-prompt']", {
      visible: true,
    });

    await page.keyboard.down("e");

    await page.waitForSelector("button[data-test-id='interaction-Change Floor']", {
      visible: true,
    });

    await page.click("button[data-test-id='interaction-Change Floor']");

    await page.waitForSelector("m-plane[color='orange']");

    await takeAndCompareScreenshot(page, 0.01);

    await page.keyboard.down("Escape");

    await page.waitForSelector("div[data-test-id='interactions-holder']", {
      hidden: false,
    });

    await takeAndCompareScreenshot(page, 0.01);

    await page.close();
  }, 60000);
});
