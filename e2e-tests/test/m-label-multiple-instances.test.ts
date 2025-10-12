import {
  clickElement,
  navigateToTestPage,
  readThreeSceneCounts,
  takeAndCompareScreenshot,
} from "./testing-utils";

describe("m-label", () => {
  test("multiple instances add/remove", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-label-multiple-instances.html/reset");

    await page.waitForSelector("#add-5-labels");

    // Capture baseline counts before adding labels
    const baseline = await readThreeSceneCounts(page);
    if (baseline) {
      // Ground mesh + shared label plane, and 3 control label textures
      expect(baseline).toMatchObject({ geometryCount: 2, textureCount: 3 });
    }

    await takeAndCompareScreenshot(page);

    // Add 5 labels
    await clickElement(page, "#add-5-labels");

    // Wait for 5 label groups under the container
    await page.waitForFunction(
      () => document.querySelectorAll("#label-container m-group").length === 5,
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterFive = await readThreeSceneCounts(page);
    if (afterFive) {
      // Shared label geometry already present; textures add: 1 remove texture + 3 variant textures
      expect(afterFive).toMatchObject({ geometryCount: 2, textureCount: 7 });
    }

    // Remove one label (middle)
    await clickElement(page, "#label-2 m-label");

    await page.waitForFunction(
      () => document.querySelectorAll("#label-container m-group").length === 4,
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterRemoveOne = await readThreeSceneCounts(page);
    if (afterRemoveOne) {
      // Removing one still leaves shared textures referenced; counts unchanged
      expect(afterRemoveOne).toMatchObject({ geometryCount: 2, textureCount: 6 });
    }

    // Add one more label
    await clickElement(page, "#add-1-label");

    await page.waitForFunction(
      () => document.querySelectorAll("#label-container m-group").length === 5,
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterAddOne = await readThreeSceneCounts(page);
    if (afterAddOne) {
      // Still using the same shared textures and geometry
      expect(afterAddOne).toMatchObject({ geometryCount: 2, textureCount: 7 });
    }

    // Remove all labels
    await clickElement(page, "#remove-all-labels");

    await page.waitForFunction(
      () => document.querySelectorAll("#label-container m-group").length === 0,
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterRemoveAll = await readThreeSceneCounts(page);
    if (afterRemoveAll) {
      // Back to baseline: ground + shared label plane, and only the 3 control label textures remain
      expect(afterRemoveAll).toMatchObject({ geometryCount: 2, textureCount: 3 });
      expect(afterRemoveAll).toEqual(baseline);
    }

    await page.close();
  }, 60000);
});
