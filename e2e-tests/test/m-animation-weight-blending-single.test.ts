import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation weight blending", () => {
  test("zero weight animations and default pose", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-weight-blending-single.test.html/reset");

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

    await page.waitForSelector("#single-animation");

    // Step 1: Start with animation weight="1"
    await page.evaluate(() => {
      document.getElementById("single-animation")!.setAttribute("weight", "1");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle w=1 (full animation, t=1000ms)");
    });
    await page.waitForSelector("#single-animation[weight='1']");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Set weight="0" (should show default pose)
    await page.evaluate(() => {
      document.getElementById("single-animation")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle w=0 (default pose, t=1500ms)");
    });
    await page.waitForSelector("#single-animation[weight='0']");
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 3: Set weight="0.5" (should blend with default pose)
    await page.evaluate(() => {
      document.getElementById("single-animation")!.setAttribute("weight", "0.5");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle w=0.5 (50% blend w/ default, t=2000ms)");
    });
    await page.waitForSelector("#single-animation[weight='0.5']");
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    // Step 4: Set weight="0" again (should return to default pose)
    await page.evaluate(() => {
      document.getElementById("single-animation")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle w=0 (back to default pose, t=2500ms)");
    });
    await page.waitForSelector("#single-animation[weight='0']");
    await setDocumentTime(page, 2500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
