import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("mml logo using m-attr-anim", () => {
  test("the mml logo is animated", async () => {
    const page = await globalThis.__BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/mml-logo.html/reset");

    await page.waitForSelector("m-attr-anim[attr='x']");

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

    await page.close();
  }, 60000);
});
