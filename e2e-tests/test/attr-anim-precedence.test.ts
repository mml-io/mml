import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim precedence", () => {
  test("animations are used in order of precedence", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-anim-precedence.html/reset");

    await page.waitForSelector("m-attr-anim[attr='x']");

    await setDocumentTime(page, 1000);

    const expectedXPositions = {
      "cube-equal-start": 2.625,
      "cube-later-start-time": 2.625,
      "cube-next-to-start": 1,
      "cube-earlier-start-time": 2.625,
      "cube-latest-end-time": 4.25,
      "cube-paused": 2.625,
    };

    for (const [id, expectedX] of Object.entries(expectedXPositions)) {
      const actualX = await page.evaluate((id) => {
        return (document.querySelector(`#${id}`) as any).getContainer().position.x;
      }, id);

      expect(`${id}: ${actualX}`).toEqual(`${id}: ${expectedX}`);
    }

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
