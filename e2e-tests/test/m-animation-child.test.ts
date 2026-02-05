import {
  clickElement,
  navigateToTestPage,
  setDocumentTime,
  takeAndCompareScreenshot,
} from "./testing-utils";

describe("m-animation", () => {
  test("child add and remove", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-child-test.html/reset");

    await page.waitForSelector("m-model");

    await page.waitForFunction(
      () => {
        const labels = document.querySelectorAll("m-label");
        return labels.length >= 6;
      },
      { timeout: 30000, polling: 100 },
    );

    // wait until the model is loaded
    await page.waitForFunction(
      () => {
        const model = document.getElementById("body-model");
        return model && (model as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    // Step 1: Initial state - no child animations
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "Initial: no child animations (default pose)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Add run animation
    await clickElement(page, "#add_run_anim-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "run child animation added w=1");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 3: Add air animation
    await clickElement(page, "#add_air_anim-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "run w=1 + air w=0.5 (both active)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 4: Remove run animation
    await clickElement(page, "#remove_run_anim-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "run removed (only air w=0.5 remains)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 5: Remove air animation
    await clickElement(page, "#remove_air_anim-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "air removed (back to default pose)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 6: Add both animations back
    await clickElement(page, "#add_run_anim-label");
    await clickElement(page, "#add_air_anim-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "both re-added: run w=1 + air w=0.5");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 7: Add anim attribute (should override children)
    await clickElement(page, "#add_anim_attr-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim=idle attr set (overrides children)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 8: Remove anim attribute (should restore children)
    await clickElement(page, "#remove_anim_attr-label");
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim removed (children restored: run+air)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
