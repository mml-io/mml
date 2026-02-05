import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation attachment behavior", () => {
  test("nested attachment hierarchy", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-attachment-nested.test.html/reset");

    // Wait for all models to load (parent, attachment level 1, attachment level 2)
    await page.waitForFunction(
      () => {
        const parentModel = document.getElementById("parent-model");
        const attachment1 = document.getElementById("attachment-level-1");
        const attachment2 = document.getElementById("attachment-level-2");
        return (
          parentModel &&
          (parentModel as any).modelGraphics?.getBoundingBox() !== null &&
          attachment1 &&
          (attachment1 as any).modelGraphics?.getBoundingBox() !== null &&
          attachment2 &&
          (attachment2 as any).modelGraphics?.getBoundingBox() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForSelector("#parent-animation");
    await page.waitForSelector("#attachment-animation");

    // Test animation propagation through hierarchy
    await page.evaluate(() => {
      document.getElementById("parent-animation")!.setAttribute("weight", "1");
      document
        .getElementById("state-label")!
        .setAttribute("content", "parent idle=1 (3-level hierarchy, t=1000ms)");
    });
    await page.waitForSelector("#parent-animation[weight='1']");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Test mixed animation modes (parent has anim attribute, attachment has child animations)
    await page.evaluate(() => {
      const parentModel = document.getElementById("parent-model")!;
      parentModel.setAttribute("anim", "/assets/anim_run.glb");
      document.getElementById("parent-animation")!.setAttribute("weight", "0");
      document.getElementById("attachment-animation")!.setAttribute("weight", "1");
    });
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "parent anim=run, attachment air=1 (mixed, t=1500ms)");
    });
    await page.waitForSelector("#parent-model[anim]");
    await page.waitForSelector("#attachment-animation[weight='1']");
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Test removal of animations at different levels
    await page.evaluate(() => {
      const parentModel = document.getElementById("parent-model")!;
      parentModel.removeAttribute("anim");
      document.getElementById("attachment-animation")!.remove();
    });
    await page.waitForSelector("#parent-model:not([anim])");
    await page.waitForFunction(
      () => {
        return document.getElementById("attachment-animation") === null;
      },
      { timeout: 5000, polling: 100 },
    );
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "all animations removed (all default, t=2000ms)");
    });
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
