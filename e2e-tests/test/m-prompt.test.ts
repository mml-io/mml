import * as puppeteer from "puppeteer";

import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-prompt", () => {
  test("visible and clickable", async () => {
    const page = (await globalThis.__BROWSER_GLOBAL__.newPage()) as puppeteer.Page;

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-prompt-test.html/reset");

    await page.waitForSelector("m-prompt");

    await takeAndCompareScreenshot(page, 0.02);

    await clickElement(page, "#my-cube-1");

    await page.waitForSelector("#my-cube-1[color='green']");

    await takeAndCompareScreenshot(page, 0.02);

    await clickElement(page, "#my-cube-2");

    await page.waitForSelector("#my-cube-2[color='yellow']");

    // Should open a prompt modal
    await takeAndCompareScreenshot(page, 0.02);

    await page.click("input[data-test-id='prompt-input']");

    // Remove "One" from the input
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    await page.type("input[data-test-id='prompt-input']", "test-value-foo");

    await page.keyboard.press("Enter");

    await page.waitForSelector("#my-label-1[content='test-value-foo']");

    await takeAndCompareScreenshot(page, 0.02);





    await clickElement(page, "#my-cube-3");

    await page.waitForSelector("#my-cube-3[color='orange']");

    // Should open a prompt modal
    await takeAndCompareScreenshot(page, 0.02);

    await page.click("input[data-test-id='prompt-input']");

    // Remove "Two" from the input
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    await page.type("input[data-test-id='prompt-input']", "test-value-bar");

    await page.keyboard.press("Enter");

    await page.waitForSelector("#my-label-2[content='test-value-bar']");

    await takeAndCompareScreenshot(page, 0.02);

    // The second modal should be showing
    await page.click("input[data-test-id='prompt-input']");

    // Remove "One" from the input
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    await page.type("input[data-test-id='prompt-input']", "test-value-baz");

    await page.keyboard.press("Enter");

    await page.waitForSelector("#my-label-1[content='test-value-baz']");

    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
