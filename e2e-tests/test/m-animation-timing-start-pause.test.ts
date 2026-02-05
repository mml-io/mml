import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation timing control", () => {
  test("start-time and pause-time with attachments", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-timing-start-pause.test.html/reset");

    // Wait for models to load
    await page.waitForFunction(
      () => {
        const parentModel = document.getElementById("parent-model");
        const attachmentModel = document.getElementById("attachment-model");
        return (
          parentModel &&
          (parentModel as any).modelGraphics?.getBoundingBox() !== null &&
          attachmentModel &&
          (attachmentModel as any).modelGraphics?.getBoundingBox() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForSelector("#timing-animation");

    // Step 1: Set document time to 500ms (both in default pose)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=500ms (before start=1000, default pose)");
    });
    await setDocumentTime(page, 500);
    await takeAndCompareScreenshot(page);

    // Step 2: Set document time to 1500ms (both animating)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=1500ms (after start=1000, run animating)");
    });
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 3: Set document time to 3500ms (both paused)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=3500ms (after pause=3000, run paused)");
    });
    await setDocumentTime(page, 3500);
    await takeAndCompareScreenshot(page);

    // Step 4: Change start-time to 500ms (should start animating)
    await page.evaluate(() => {
      document.getElementById("timing-animation")!.setAttribute("start-time", "500");
    });
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=4000ms, start=500 (run should be animating)");
    });
    await page.waitForSelector("#timing-animation[start-time='500']");
    await setDocumentTime(page, 4000);
    await takeAndCompareScreenshot(page);

    // Step 5: Remove pause-time (should continue past previous pause)
    await page.evaluate(() => {
      document.getElementById("timing-animation")!.removeAttribute("pause-time");
    });
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "t=4500ms, no pause (run continues animating)");
    });
    await setDocumentTime(page, 4500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
