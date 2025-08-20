import {
  clickElement,
  navigateToTestPage,
  setDocumentTime,
  takeAndCompareScreenshot,
} from "./testing-utils";

describe("m-animation anim removal", () => {
  test("child animations work after model anim attribute removal", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-anim-removal-test.html/reset");

    await page.waitForSelector("m-model");

    await page.waitForFunction(
      () => {
        const labels = document.querySelectorAll("m-label");
        return labels.length === 5;
      },
      { timeout: 30000, polling: 100 },
    );

    // wait until both models are loaded
    await page.waitForFunction(
      () => {
        const testModel = document.getElementById("test-model");
        const referenceModel = document.getElementById("reference-model");
        return (
          testModel &&
          (testModel as any).modelGraphics.getBoundingBox() !== null &&
          referenceModel &&
          (referenceModel as any).modelGraphics.getBoundingBox() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    // Step 1: Initial state - no anim attribute, no child animations
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 2: Set model anim attribute (should play idle animation)
    await clickElement(page, "#set_anim_attr-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 3: Remove model anim attribute (should return to no animation)
    await clickElement(page, "#remove_anim_attr-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 4: Add child animation (this was the bug - should work now)
    await clickElement(page, "#add_child_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 5: Add second child animation (test multiple child animations)
    await clickElement(page, "#add_second_child-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 6: Remove first child animation (should keep second one)
    await clickElement(page, "#remove_child_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 7: Add first child animation back (test robustness)
    await clickElement(page, "#add_child_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 8: Test the problematic sequence again - set anim attr while child animations exist
    await clickElement(page, "#set_anim_attr-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 9: Remove anim attr - child animations should be restored
    await clickElement(page, "#remove_anim_attr-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
