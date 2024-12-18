import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-model", () => {
  test("animation pause", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-model-anim-pause-test.html/reset");

    await page.waitForSelector("m-model");

    // Wait until the model is loaded
    await page.waitForFunction(
      () => {
        const model = document.querySelector("m-model");
        return (model as any).modelGraphics.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
