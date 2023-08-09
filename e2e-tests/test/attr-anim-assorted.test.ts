import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim assorted", () => {
  test("assorted attributes are affected by animations", async () => {
    const page = await globalThis.__BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-anim-assorted.html/reset");

    await page.waitForSelector("m-attr-anim[attr='color']");

    await setDocumentTime(page, 0);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 1000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 2000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 3000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 4000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 5000);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
