import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-frame", () => {
  test("static content visible", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-frame-static-test.html/reset");

    await page.waitForSelector("m-frame");

    await page.waitForSelector("m-cube");

    const textSelector = await page.waitForSelector("m-label");
    const fullTitle = await textSelector?.evaluate((el) => el.getAttribute("content"));
    expect(fullTitle).toEqual("This is static MML in an m-frame");

    // Wait for the m-image inside the static content to load
    await page.waitForFunction(
      () => {
        const { height } = (
          document.querySelectorAll("m-image")[0] as any
        ).imageGraphics!.getWidthAndHeight();
        return height > 3;
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
