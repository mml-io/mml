import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim sequences", () => {
  test("animations are sequenced", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "attr-anim-sequences.html/reset");

    await page.waitForSelector("m-attr-anim[attr='x']");

    await setDocumentTime(page, 1000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 3500);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 6000);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 8500);

    await takeAndCompareScreenshot(page);

    await setDocumentTime(page, 11000);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
