import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-frame", () => {
  test("static content visible", async () => {
    const page = await globalThis.__BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:8079/m-frame-static-test.html/reset");

    await page.waitForSelector("m-frame");

    await page.waitForSelector("m-cube");

    const textSelector = await page.waitForSelector("m-label");
    const fullTitle = await textSelector?.evaluate((el) => el.getAttribute("content"));
    expect(fullTitle).toEqual("This is static MML in an m-frame");

    // Wait for the m-image inside the static content to load
    await page.waitForFunction(
      () => {
        return (document.querySelector("m-image") as any).getImageMesh().scale.y > 3;
      },
      { timeout: 5000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
