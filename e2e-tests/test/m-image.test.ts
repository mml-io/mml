import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-image", () => {
  test("image visible", async () => {
    const page = await globalThis.__BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-image-test.html/reset");

    // Wait for the m-image content to load
    await page.waitForFunction(
      () => {
        return (document.querySelector("m-image") as any).getImageMesh().scale.y > 3;
      },
      { timeout: 5000, polling: 100 },
    );

    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
