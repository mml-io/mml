import { clickElement, navigateToTestPage, takeAndCompareScreenshot } from "./testing-utils";

describe("m-image opacity toggling", () => {
  test("image opacity changes are correctly applied", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();
    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-image-test.html/reset");

    const opacityToggleImageSelector = "#toggle-image";

    // Wait until all m-image elements have valid dimensions
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

    // Initial screenshot before opacity change
    await takeAndCompareScreenshot(page, 0.02);

    // clicks to set the opacity attribute to 0.5
    await clickElement(page, "m-cylinder");

    // Wait for opacity to become 0.5
    await page.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const opacityAttr = element.getAttribute("opacity");
        return opacityAttr !== null && parseFloat(opacityAttr) === 0.5;
      },
      { timeout: 30000, polling: 100 },
      opacityToggleImageSelector,
    );

    // Screenshot with opacity is set to 0.5
    await takeAndCompareScreenshot(page, 0.02);

    // clicks again to remove the opacity attribute
    await clickElement(page, "m-cylinder");

    // Wait for opacity attribute to be removed
    await page.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        return !element.getAttribute("opacity");
      },
      { timeout: 30000, polling: 100 },
      opacityToggleImageSelector,
    );

    // Final screenshot after opacity attribute is removed
    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
