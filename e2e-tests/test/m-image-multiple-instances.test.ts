import {
  clickElement,
  navigateToTestPage,
  readThreeSceneCounts,
  takeAndCompareScreenshot,
} from "./testing-utils";

describe("m-image", () => {
  test("multiple instances add/remove", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-image-multiple-instances.html/reset");

    await page.waitForSelector("#load-5-images");

    // Capture baseline counts before adding images
    const baseline = await readThreeSceneCounts(page);
    if (baseline) {
      // The base scene contains a ground mesh, and a single reused mesh for the labels, and then 6 unique label textures
      expect(baseline).toMatchObject({ geometryCount: 2, textureCount: 6 });
    }

    await takeAndCompareScreenshot(page);

    // Load 5 images
    await clickElement(page, "#load-5-images");

    await page.waitForFunction(
      () => {
        const images = Array.from(document.querySelectorAll("m-image"));
        if (images.length < 5) return false;
        return images.every((img: any) => {
          const dims = img.imageGraphics?.getWidthAndHeight?.();
          if (!dims) return false;
          const { width, height } = dims;
          return width > 0 && height > 0;
        });
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterFive = await readThreeSceneCounts(page);
    if (afterFive) {
      // 1 additional geometry (the image quad), and 2 additional textures (the image texture + a remove label texture)
      expect(afterFive).toMatchObject({ geometryCount: 3, textureCount: 8 });
    }

    // Remove one image in the middle
    await clickElement(page, "#image-2 m-label");

    await page.waitForFunction(() => document.querySelectorAll("m-image").length === 4, {
      timeout: 30000,
      polling: 100,
    });

    await takeAndCompareScreenshot(page);

    const afterRemoveOne = await readThreeSceneCounts(page);
    if (afterRemoveOne) {
      // Removing one image should not change the geometry or texture count (shared geometry/texture still in use)
      expect(afterRemoveOne).toMatchObject({ geometryCount: 3, textureCount: 8 });
    }

    // Add one more
    await clickElement(page, "#load-1-image");

    await page.waitForFunction(
      () => {
        const images = Array.from(document.querySelectorAll("m-image"));
        if (images.length < 5) return false;
        return images.every((img: any) => {
          const dims = img.imageGraphics?.getWidthAndHeight?.();
          if (!dims) return false;
          const { width, height } = dims;
          return width > 0 && height > 0;
        });
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const afterAddOne = await readThreeSceneCounts(page);
    if (afterAddOne) {
      // Adding one image should not change counts (still shared geometry/texture)
      expect(afterAddOne).toMatchObject({ geometryCount: 3, textureCount: 8 });
    }

    // Remove all images
    await clickElement(page, "#remove-all-images");

    await page.waitForFunction(() => document.querySelectorAll("m-image").length === 0, {
      timeout: 30000,
      polling: 100,
    });

    await takeAndCompareScreenshot(page);

    const afterRemoveAll = await readThreeSceneCounts(page);
    if (afterRemoveAll) {
      // Removing all images should return to the baseline counts
      expect(afterRemoveAll).toMatchObject({ geometryCount: 2, textureCount: 6 });
      expect(afterRemoveAll).toEqual(baseline);
    }

    await page.close();
  }, 60000);
});
