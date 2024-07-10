import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-label-emissive", () => {
  test("label emissive", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-label-emissive-test.html/reset");

    await page.waitForSelector("m-label");

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
