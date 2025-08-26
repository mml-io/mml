import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation timing control", () => {
  test("loop behavior with attachments", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-timing-loop.test.html/reset");

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

    await page.waitForSelector("#loop-animation");

    // Step 1: Test through multiple loop cycles with loop=false
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "loop=false, t=500ms (run animating)");
    });
    await setDocumentTime(page, 500);
    await takeAndCompareScreenshot(page);

    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "loop=false, t=1500ms (run cycle ended, stopped)");
    });
    await setDocumentTime(page, 1500); // After first cycle should end
    await takeAndCompareScreenshot(page);

    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "loop=false, t=2500ms (run still stopped)");
    });
    await setDocumentTime(page, 2500); // Well after first cycle
    await takeAndCompareScreenshot(page);

    // Step 3: Set loop=true
    await page.evaluate(() => {
      document.getElementById("loop-animation")!.setAttribute("loop", "true");
    });
    await page.waitForSelector("#loop-animation[loop='true']");

    // Step 4: Verify both continue looping
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "loop=true, t=3500ms (run looping again)");
    });
    await setDocumentTime(page, 3500); // Should be animating again
    await takeAndCompareScreenshot(page);

    // Step 5: Test loop transitions during playback
    await page.evaluate(() => {
      document.getElementById("loop-animation")!.setAttribute("loop", "false");
    });
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "loop=false during playback, t=4000ms (run stops)");
    });
    await page.waitForSelector("#loop-animation[loop='false']");
    await setDocumentTime(page, 4000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
