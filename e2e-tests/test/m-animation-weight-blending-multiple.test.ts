import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation weight blending", () => {
  test("multiple animations with varying weights", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-weight-blending-multiple.test.html/reset");

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

    await page.waitForSelector("#animation1");
    await page.waitForSelector("#animation2");
    await page.waitForSelector("#animation3");

    // Step 1: All weights at 0 (default pose)
    await page.evaluate(() => {
      document.getElementById("animation1")!.setAttribute("weight", "0");
      document.getElementById("animation2")!.setAttribute("weight", "0");
      document.getElementById("animation3")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle=0, air=0, run=0 (default pose, t=1000ms)");
    });
    await page.waitForSelector("#animation1[weight='0']");
    await page.waitForSelector("#animation2[weight='0']");
    await page.waitForSelector("#animation3[weight='0']");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Animation1 weight=1, others=0
    await page.evaluate(() => {
      document.getElementById("animation1")!.setAttribute("weight", "1");
      document.getElementById("animation2")!.setAttribute("weight", "0");
      document.getElementById("animation3")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle=1, air=0, run=0 (full idle, t=1500ms)");
    });
    await page.waitForSelector("#animation1[weight='1']");
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 3: Animation1 weight=0.5, Animation2 weight=0.5, Animation3=0
    await page.evaluate(() => {
      document.getElementById("animation1")!.setAttribute("weight", "0.5");
      document.getElementById("animation2")!.setAttribute("weight", "0.5");
      document.getElementById("animation3")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle=0.5, air=0.5, run=0 (50/50 blend, t=2000ms)");
    });
    await page.waitForSelector("#animation1[weight='0.5']");
    await page.waitForSelector("#animation2[weight='0.5']");
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    // Step 4: All weights=0.33 (total < 1, should blend with default pose)
    await page.evaluate(() => {
      document.getElementById("animation1")!.setAttribute("weight", "0.33");
      document.getElementById("animation2")!.setAttribute("weight", "0.33");
      document.getElementById("animation3")!.setAttribute("weight", "0.33");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle=0.33, air=0.33, run=0.33 (sum<1, default blend, t=2500ms)");
    });
    await page.waitForSelector("#animation1[weight='0.33']");
    await page.waitForSelector("#animation2[weight='0.33']");
    await page.waitForSelector("#animation3[weight='0.33']");
    await setDocumentTime(page, 2500);
    await takeAndCompareScreenshot(page);

    // Step 5: Animation1=0.6, Animation2=0.6 (total > 1, should normalize)
    await page.evaluate(() => {
      document.getElementById("animation1")!.setAttribute("weight", "0.6");
      document.getElementById("animation2")!.setAttribute("weight", "0.6");
      document.getElementById("animation3")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle=0.6, air=0.6, run=0 (sum>1, normalized, t=3000ms)");
    });
    await page.waitForSelector("#animation1[weight='0.6']");
    await page.waitForSelector("#animation2[weight='0.6']");
    await setDocumentTime(page, 3000);
    await takeAndCompareScreenshot(page);

    // Step 6: All weights back to 0 (should return to default pose)
    await page.evaluate(() => {
      document.getElementById("animation1")!.setAttribute("weight", "0");
      document.getElementById("animation2")!.setAttribute("weight", "0");
      document.getElementById("animation3")!.setAttribute("weight", "0");
      document
        .getElementById("state-label")!
        .setAttribute("content", "idle=0, air=0, run=0 (back to default, t=3500ms)");
    });
    await page.waitForSelector("#animation1[weight='0']");
    await page.waitForSelector("#animation2[weight='0']");
    await page.waitForSelector("#animation3[weight='0']");
    await setDocumentTime(page, 3500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
