import * as puppeteer from "puppeteer";

import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-link", () => {
  test("visible and clickable", async () => {
    const browser: puppeteer.Browser = globalThis.__BROWSER_GLOBAL__;
    const page = (await browser.newPage()) as puppeteer.Page;

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-link-test.html/reset");

    await page.waitForSelector("m-link");

    await takeAndCompareScreenshot(page, 0.02);

    await clickElement(page, "#my-cube");

    // Should open a link modal
    await takeAndCompareScreenshot(page, 0.02);


    const [target] = await Promise.all([
      new Promise((resolve) => browser.once("targetcreated", resolve)),
      // Clicking ok should navigate to the link in a new tab
      page.click("button[data-test-id='confirm-modal-ok-button']"),
    ]);

    const newPage: puppeteer.Page = await (target as any).page();
    await newPage.bringToFront();

    // Check contents of new page
    await takeAndCompareScreenshot(newPage, 0.02);

    await page.close();
  }, 60000);
});
