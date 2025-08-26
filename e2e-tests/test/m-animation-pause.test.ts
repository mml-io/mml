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

    // Step 1: t=500ms - only air animations playing (run hasn't started yet)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=500ms: all air only (run not started)");
    });
    await setDocumentTime(page, 500);
    await takeAndCompareScreenshot(page);

    // Step 2: t=1100ms - model-a air+run, others air only
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=1100ms: A=air+run, B&C=air only");
    });
    await setDocumentTime(page, 1100);
    await takeAndCompareScreenshot(page);

    // Step 3: t=2100ms - model-a&b air+run, model-c air only
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=2100ms: A&B=air+run, C=air only");
    });
    await setDocumentTime(page, 2100);
    await takeAndCompareScreenshot(page);

    // Step 4: t=3100ms - all models air+run
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=3100ms: all air+run active");
    });
    await setDocumentTime(page, 3100);
    await takeAndCompareScreenshot(page);

    // Step 5: t=3700ms - model-c run stopped (loop=false), others continue
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=3700ms: A&B=air+run, C=air (run stopped)");
    });
    await setDocumentTime(page, 3700);
    await takeAndCompareScreenshot(page);

    // Step 6: t=5100ms - model-b paused, others continue
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=5100ms: A=air+run, B=air (paused), C=air");
    });
    await setDocumentTime(page, 5100);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
