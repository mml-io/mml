import { clickElement, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation", () => {
  test("weight blending with lerp", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-animation-weights-test.html/reset");

    await page.waitForSelector("m-model");

    await page.waitForFunction(
      () => {
        const labels = document.querySelectorAll("m-label");
        return labels.length === 9;
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForFunction(
      () => {
        const attrLerp = document.querySelectorAll("m-attr-lerp");
        return attrLerp.length === 3;
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForFunction(
      () => {
        const animations = document.querySelectorAll("m-animation");
        return animations.length === 3;
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
    // consistent doc time for all screenshots
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_0_0-label");
    await clickElement(page, "#air_0_0-label");
    await clickElement(page, "#run_0_0-label");
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_1_0-label");
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#air_1_0-label");
    await setDocumentTime(page, 2500);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#run_1_0-label");
    await setDocumentTime(page, 3000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_1_0-label");
    await clickElement(page, "#air_0_0-label");
    await clickElement(page, "#run_0_0-label");
    await setDocumentTime(page, 3500);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_0_0-label");
    await clickElement(page, "#air_1_0-label");
    await clickElement(page, "#run_0_0-label");
    await setDocumentTime(page, 4000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_0_0-label");
    await clickElement(page, "#air_0_0-label");
    await clickElement(page, "#run_1_0-label");
    await setDocumentTime(page, 4500);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_0_0-label");
    await clickElement(page, "#air_0_0-label");
    await clickElement(page, "#run_0_5-label");
    await setDocumentTime(page, 5000);
    await takeAndCompareScreenshot(page);

    await clickElement(page, "#idle_0_0-label");
    await clickElement(page, "#air_0_0-label");
    await clickElement(page, "#run_0_0-label");
    await setDocumentTime(page, 5500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
