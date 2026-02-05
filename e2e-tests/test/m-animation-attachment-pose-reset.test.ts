import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation attachment behavior", () => {
  test("attachment pose reset during mode transitions", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-attachment-pose-reset.test.html/reset");

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

    await page.waitForSelector("#parent-model[anim]");
    await page.waitForSelector("#child-animation");

    // Step 1: Start with anim attribute active (specific pose)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim=run active (parent+attachment, t=1000ms)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 3: Remove anim attribute to activate child animations with weight=0
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.removeAttribute("anim");
    });
    await page.waitForSelector("#parent-model:not([anim])");

    // Step 4: Take screenshot (attachment should be in default pose, not stuck in anim pose)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim removed, child w=0 (both default, t=1500ms)");
    });
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 5: Set child animation weight=1
    await page.evaluate(() => {
      document.getElementById("child-animation")!.setAttribute("weight", "1");
    });
    await page.waitForSelector("#child-animation[weight='1']");

    // Step 6: Take screenshot (should animate from default pose cleanly)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "child idle w=1 (from default pose, t=2000ms)");
    });
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
