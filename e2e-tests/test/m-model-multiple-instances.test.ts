import {
  clickElement,
  navigateToTestPage,
  readThreeSceneCounts,
  takeAndCompareScreenshot,
} from "./testing-utils";

describe("m-model", () => {
  test("multiple instances add/remove", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-model-multiple-instances.html/reset");

    await page.waitForSelector("#load-5-ducks");

    await takeAndCompareScreenshot(page);

    // Capture baseline counts before adding ducks
    const baseline = await readThreeSceneCounts(page);
    if (baseline) {
      // The base scene contains a ground mesh, and a single reused mesh for the labels, and then 6 unique label textures
      expect(baseline).toMatchObject({ geometryCount: 1, textureCount: 6 });
    }

    // Load 5 ducks
    await clickElement(page, "#load-5-ducks");

    await page.waitForFunction(
      () => {
        const models = document.querySelectorAll("m-model");
        if (models.length < 5) {
          return false;
        }
        return Array.from(models).every(
          (model) => (model as any).modelGraphics.getBoundingBox() !== null,
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterFive = await readThreeSceneCounts(page);
    if (afterFive) {
      // 1 additional geometry (the duck model), and 2 additional textures (the duck texture + a remove label texture)
      expect(afterFive).toMatchObject({ geometryCount: 2, textureCount: 8 });
    }

    // Remove one duck in the middle
    await clickElement(page, "#duck-2 m-label");

    await page.waitForFunction(() => document.querySelectorAll("m-model").length === 4);

    await takeAndCompareScreenshot(page);

    const afterRemoveOne = await readThreeSceneCounts(page);
    if (afterRemoveOne) {
      // Removing one duck should not change the geometry or texture count (there are still instances of both the duck model and the remove label texture)
      expect(afterRemoveOne).toMatchObject({ geometryCount: 2, textureCount: 8 });
    }

    // Add one more
    await clickElement(page, "#load-1-duck");

    await page.waitForFunction(
      () => {
        const models = document.querySelectorAll("m-model");
        if (models.length < 5) {
          return false;
        }
        return Array.from(models).every(
          (model) => (model as any).modelGraphics.getBoundingBox() !== null,
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterAddOne = await readThreeSceneCounts(page);
    if (afterAddOne) {
      // Adding one duck should not change the geometry or texture count (there are still instances of both the duck model and the remove label texture)
      expect(afterAddOne).toMatchObject({ geometryCount: 2, textureCount: 8 });
    }

    // Remove all ducks
    await clickElement(page, "#remove-all-ducks");

    await page.waitForFunction(() => document.querySelectorAll("m-model").length === 0);

    await takeAndCompareScreenshot(page);

    const afterRemoveAll = await readThreeSceneCounts(page);
    if (afterRemoveAll) {
      // Removing all ducks should return to the baseline geometry and texture count (the ground mesh, the label mesh, and the 6 label textures)
      expect(afterRemoveAll).toMatchObject({ geometryCount: 1, textureCount: 6 });
      expect(afterRemoveAll).toEqual(baseline);
    }

    await page.close();
  }, 60000);
});
