import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation state transitions", () => {
  test("anim attribute to child animations transition", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-state-transitions-anim-to-child.test.html/reset");

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

    // Wait for child animation element to be present
    await page.waitForSelector("#child-animation");

    // Step 1: Take screenshot with anim attribute active
    await page.evaluate(() => {
      document.getElementById("state-label")!.setAttribute("content", "anim=run active (t=1000ms)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Remove anim attribute to activate child animations
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.removeAttribute("anim");
    });

    // Wait for transition to complete
    await page.waitForSelector("#parent-model:not([anim])");

    // Step 3: Take screenshot showing child animations now active
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim removed, child idle w=1 (t=1500ms)");
    });
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
