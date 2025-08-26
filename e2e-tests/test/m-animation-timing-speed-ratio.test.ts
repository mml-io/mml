import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation timing control", () => {
  test("speed and ratio synchronization", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-timing-speed-ratio.test.html/reset");

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

    await page.waitForSelector("#speed-animation");

    // Step 1: Set speed=2 (verify both animate at double speed)
    await page.evaluate(() => {
      document.getElementById("speed-animation")!.setAttribute("speed", "2");
      document
        .getElementById("state-label")!
        .setAttribute("content", "speed=2 (run double speed, t=1000ms)");
    });
    await page.waitForSelector("#speed-animation[speed='2']");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Set ratio=0.5 (verify both jump to middle of animation)
    await page.evaluate(() => {
      document.getElementById("speed-animation")!.setAttribute("ratio", "0.5");
      document
        .getElementById("state-label")!
        .setAttribute("content", "ratio=0.5 (middle of run anim, t=1500ms)");
    });
    await page.waitForSelector("#speed-animation[ratio='0.5']");
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 3: Set speed=0.5, ratio=null (verify both animate at half speed)
    await page.evaluate(() => {
      const animation = document.getElementById("speed-animation")!;
      animation.setAttribute("speed", "0.5");
      animation.removeAttribute("ratio");
    });
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "speed=0.5, ratio=null (run half speed, t=2000ms)");
    });
    await page.waitForSelector("#speed-animation[speed='0.5']");
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
