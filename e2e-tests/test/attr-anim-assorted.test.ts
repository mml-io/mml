import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim assorted", () => {
  test("assorted attributes are affected by animations", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-anim-assorted.html/reset");

    await page.waitForSelector("m-attr-anim[attr='color']");

    /*
    The test image used in this particular test document is 768x432 (1.777..78 aspect ratio)
    We'll be confident the image has loaded once the Mesh was already expanded to such
    aspect ratio, which will only happen once the image is loaded.
    */
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-image") as any).every((img: any) => {
          const { width, height } = img.imageGraphics!.getWidthAndHeight();
          const aspect = width / height;
          const hasCorrectAspect = Math.abs(aspect - 1.78) < 0.01;
          return hasCorrectAspect;
        });
      },
      { timeout: 30000, polling: 100 },
    );

    await setDocumentTime(page, 0);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 1000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 2000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 3000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 4000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 5000);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
