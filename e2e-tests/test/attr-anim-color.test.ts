import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim color", () => {
  test("color is affected by animations", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-anim-color.html/reset");

    await page.waitForSelector("m-attr-anim[attr='color']");

    await setDocumentTime(page, 0);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 2500);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 5000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 7500);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 10000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 12500);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
