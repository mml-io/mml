import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation", () => {
  test("child add and remove", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-animation-child-test.html/reset");

    await page.waitForSelector("m-model");

    await page.waitForFunction(
      () => {
        const labels = document.querySelectorAll("m-label");
        return labels.length === 4;
      },
      { timeout: 30000, polling: 100 },
    );

    // wait until the model is loaded
    await page.waitForFunction(
      () => {
        const model = document.querySelector("m-model");
        return (model as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await clickElement(page, "#add_run_anim-label");
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#add_air_anim-label");
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#remove_run_anim-label");
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#remove_air_anim-label");
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
