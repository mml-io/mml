import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-frame", () => {
  test("bounds test", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-frame-bounds-test.html/reset");

    await page.waitForSelector("m-image");

    // Wait for the m-image content to load
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-image") as any).every((img: any) => {
          const aspect = img.getImageMesh().scale.x / img.getImageMesh().scale.y;
          const hasCorrectAspect = Math.abs(aspect - 1.333) < 0.01;
          return hasCorrectAspect;
        });
      },
      { timeout: 5000, polling: 100 },
    );
    // Wait for the m-video content to load
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-video") as any).every((video: any) => {
          const aspect = video.getVideoMesh().scale.x / video.getVideoMesh().scale.y;
          const hasCorrectAspect = Math.abs(aspect - 1.777) < 0.01;
          return hasCorrectAspect;
        });
      },
      { timeout: 5000, polling: 100 },
    );

    // Wait until the model is loaded
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-model") as any).every((model: any) => {
          return (model as any).getModel() !== null;
        });
      },
      { timeout: 5000, polling: 100 },
    );

    async function getVisibilityOfContainersForTags() {
      return await page.evaluate(() => {
        const tags = ["m-image", "m-video", "m-model"];
        const results: { [key: string]: { count: number; visible: number } } = {};
        tags.forEach((tag) => {
          const elements = Array.from(document.querySelectorAll(tag));
          results[tag] = {
            count: elements.length,
            visible: elements.filter((element) => (element as any).container.visible === true)
              .length,
          };
        });
        return results;
      });
    }

    // All visible
    await setDocumentTime(page, 0);
    await takeAndCompareScreenshot(page);

    // All visible - on edge of frame
    await setDocumentTime(page, 1499);
    await takeAndCompareScreenshot(page);
    expect(await getVisibilityOfContainersForTags()).toEqual({
      "m-image": { count: 1, visible: 1 },
      "m-video": { count: 1, visible: 1 },
      "m-model": { count: 2, visible: 2 },
    });

    // All invisible - exceeded frame
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);
    expect(await getVisibilityOfContainersForTags()).toEqual({
      "m-image": { count: 1, visible: 0 },
      "m-video": { count: 1, visible: 0 },
      "m-model": { count: 2, visible: 0 },
    });

    // All invisible - exceeded frame (about to return)
    await setDocumentTime(page, 3500);
    await takeAndCompareScreenshot(page);
    expect(await getVisibilityOfContainersForTags()).toEqual({
      "m-image": { count: 1, visible: 0 },
      "m-video": { count: 1, visible: 0 },
      "m-model": { count: 2, visible: 0 },
    });

    // All visible - on edge of frame
    await setDocumentTime(page, 3501);
    await takeAndCompareScreenshot(page);
    expect(await getVisibilityOfContainersForTags()).toEqual({
      "m-image": { count: 1, visible: 1 },
      "m-video": { count: 1, visible: 1 },
      "m-model": { count: 2, visible: 2 },
    });

    // All visible
    await setDocumentTime(page, 5000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
