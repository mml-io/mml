import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation state transitions", () => {
  test("child animations to anim attribute transition", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-state-transitions-child-to-anim.test.html/reset");

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

    // Step 1: Take screenshot with child animations active
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "child idle w=1 active (t=1000ms)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Set anim attribute to override child animations
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.setAttribute("anim", "/assets/anim_idle.glb");
    });

    // Wait for anim attribute to take effect
    await page.waitForSelector("#parent-model[anim]");

    // Step 3: Take screenshot showing anim attribute animation
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim=idle set, overrides child (t=1500ms)");
    });
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
