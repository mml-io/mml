import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-label", () => {
  test("label visible", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-label-test.html/reset");

    await page.waitForSelector("m-label");

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
