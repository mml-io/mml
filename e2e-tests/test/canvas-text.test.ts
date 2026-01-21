import { navigateToTestPage, takeAndCompareScreenshot } from "./testing-utils";

describe("m-image canvas text rendering", () => {
  test("canvas text based m-image", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "canvas-text-test.html/reset");

    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-image") as any).every((img: any) => {
          const { width, height } = img.imageGraphics!.getWidthAndHeight();
          const aspect = width / height;
          return aspect === 1;
        });
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
