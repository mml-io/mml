import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation attachment behavior", () => {
  test("attachment animation cleanup on removal", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-attachment-cleanup.test.html/reset");

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

    await page.waitForSelector("#test-animation");

    // Step 1: Start with child animation playing on both parent and attachment
    await page.evaluate(() => {
      document.getElementById("test-animation")!.setAttribute("weight", "1");
      document
        .getElementById("state-label")!
        .setAttribute("content", "child idle w=1 (parent+attachment, t=1000ms)");
    });
    await page.waitForSelector("#test-animation[weight='1']");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 3: Remove the child animation element from DOM
    await page.evaluate(() => {
      const animation = document.getElementById("test-animation")!;
      animation.remove();
    });

    // Wait for removal to take effect
    await page.waitForFunction(
      () => {
        return document.getElementById("test-animation") === null;
      },
      { timeout: 5000, polling: 100 },
    );

    // Step 4: Take screenshot (both should return to default pose)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "animation removed (both default pose, t=1500ms)");
    });
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 5: Add new different child animation
    await page.evaluate(() => {
      const parentModel = document.getElementById("parent-model")!;
      const newAnimation = document.createElement("m-animation");
      newAnimation.setAttribute("id", "new-animation");
      newAnimation.setAttribute("src", "/assets/anim_air.glb");
      newAnimation.setAttribute("weight", "1");
      parentModel.appendChild(newAnimation);
    });

    await page.waitForSelector("#new-animation");
    await page.waitForSelector("#new-animation[weight='1']");

    // Step 6: Take screenshot (both should play new animation)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "new air anim w=1 (parent+attachment, t=2000ms)");
    });
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
