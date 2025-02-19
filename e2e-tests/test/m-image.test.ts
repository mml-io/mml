import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-image opacity toggling with label tracking", () => {
  test("image opacity changes with label indication", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();
    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-image-test.html/reset");

    await page.waitForFunction(
      () => {
        const images = Array.from(document.querySelectorAll("m-image"));
        return (
          images.length > 2 &&
          images.every((img: any) => {
            const { width, height } = img.imageGraphics?.getWidthAndHeight() ?? {
              width: 0,
              height: 0,
            };
            return width > 0 && height >= 3;
          })
        );
      },
      { timeout: 30000, polling: 100 },
    );

    const labelSelector = "#label-group m-label";

    // Initial screenshot before any opacity change
    await takeAndCompareScreenshot(page, 0.02);

    // Wait until the label appears with content "Opacity: 0.5 added"
    await page.waitForFunction(
      (selector) => {
        const label = document.querySelector(selector);
        return label && label.getAttribute("content") === "Opacity: 0.5 added";
      },
      { timeout: 10000, polling: 100 },
      labelSelector,
    );

    await takeAndCompareScreenshot(page, 0.02);

    await page.waitForFunction(
      (selector) => {
        const label = document.querySelector(selector);
        return label && label.getAttribute("content") === "Opacity attribute removed";
      },
      { timeout: 10000, polling: 100 },
      labelSelector,
    );

    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
