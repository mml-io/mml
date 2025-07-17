import { clickElement, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation", () => {
  test("child add and remove", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-animation-child-test.html/reset");

    await page.waitForSelector("m-model");

    await page.waitForFunction(
      () => {
        const labels = document.querySelectorAll("m-label");
        return labels.length === 6;
      },
      { timeout: 30000, polling: 100 },
    );

    // wait until the model is loaded
    await page.waitForFunction(
      () => {
        const model = document.getElementById("body-model");
        return model && (model as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForFunction(
      () => {
        const secondModel = document.getElementById("body-model-b");
        return secondModel && (secondModel as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    // consistent doc time for all screenshots
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#add_run_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#add_air_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#remove_run_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#remove_air_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#add_run_anim-label");
    await clickElement(page, "#add_air_anim-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#add_anim_attr-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#remove_anim_attr-label");
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
