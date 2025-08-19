import { clickElement, navigateToTestPage, takeAndCompareScreenshot } from "./testing-utils";

describe("m-element-socket", () => {
  test("socketed element animation inheritance", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-model-socket-nest-test.html/reset");

    await page.waitForSelector("m-character");

    // Wait until the character is loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (
          (character as any).modelGraphics.hasLoadedModel() &&
          (character as any).modelGraphics.hasLoadedAnimation()
        );
      },
      { timeout: 10000, polling: 100 },
    );

    await page.waitForSelector("m-model");

    await takeAndCompareScreenshot(page);

    await clickElement(page, "m-cube");

    // Wait until sub-character is loaded
    await page.waitForFunction(
      () => {
        const firstModel = document.getElementById("sub-character");
        return firstModel && (firstModel as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 15000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await clickElement(page, "m-cube");

    // Wait until sub-sub-character is loaded
    await page.waitForFunction(
      () => {
        const secondModel = document.getElementById("sub-sub-character");
        return secondModel && (secondModel as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 15000, polling: 100 },
    );
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
