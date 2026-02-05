import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation weight blending", () => {
  test("attachment weight independence", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-weight-blending-independent.test.html/reset");

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

    await page.waitForSelector("#parent-animation");
    await page.waitForSelector("#attachment-animation");

    // Test different weight combinations to verify independence

    // Parent animation weight=1, attachment weight=0
    await page.evaluate(() => {
      document.getElementById("parent-animation")!.setAttribute("weight", "1");
      document.getElementById("attachment-animation")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "parent idle=1, attachment air=0 (independent, t=1000ms)");
    });
    await page.waitForSelector("#parent-animation[weight='1']");
    await page.waitForSelector("#attachment-animation[weight='0']");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Parent animation weight=0, attachment weight=1
    await page.evaluate(() => {
      document.getElementById("parent-animation")!.setAttribute("weight", "0");
      document.getElementById("attachment-animation")!.setAttribute("weight", "1");
      document
        .getElementById("state-label")!
        .setAttribute("content", "parent idle=0, attachment air=1 (independent, t=1500ms)");
    });
    await page.waitForSelector("#parent-animation[weight='0']");
    await page.waitForSelector("#attachment-animation[weight='1']");
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Both at weight=0.5
    await page.evaluate(() => {
      document.getElementById("parent-animation")!.setAttribute("weight", "0.5");
      document.getElementById("attachment-animation")!.setAttribute("weight", "0.5");
      document
        .getElementById("state-label")!
        .setAttribute("content", "parent idle=0.5, attachment air=0.5 (both blend, t=2000ms)");
    });
    await page.waitForSelector("#parent-animation[weight='0.5']");
    await page.waitForSelector("#attachment-animation[weight='0.5']");
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    // Both back to weight=0 (default pose)
    await page.evaluate(() => {
      document.getElementById("parent-animation")!.setAttribute("weight", "0");
      document.getElementById("attachment-animation")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "parent idle=0, attachment air=0 (both default, t=2500ms)");
    });
    await page.waitForSelector("#parent-animation[weight='0']");
    await page.waitForSelector("#attachment-animation[weight='0']");
    await setDocumentTime(page, 2500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
