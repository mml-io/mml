import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation", () => {
  test("pause and loop attributes", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-pause-test.html/reset");

    await page.waitForSelector("m-model");

    // wait until the model A is loaded
    await page.waitForFunction(
      () => {
        const modelA = document.getElementById("body-model-a");
        return modelA && (modelA as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForFunction(
      () => {
        const modelB = document.getElementById("body-model-b");
        return modelB && (modelB as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForFunction(
      () => {
        const modelC = document.getElementById("body-model-c");
        return modelC && (modelC as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    // consistent doc time for all screenshots
    await setDocumentTime(page, 500);
    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 1100);
    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 2100);
    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 3100);
    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 3700);
    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 5100);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
