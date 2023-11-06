import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim easing", () => {
  test("animations are eased using the specified functions", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-anim-easing.html/reset");

    await page.waitForSelector("m-attr-anim[attr='x']");

    const expectedXPositions = {
      "cube-linear": {
        0: -2,
        1250: -1,
        2500: 0,
        3750: 1,
        5000: -2,
        7500: 0,
        10000: -2,
        12500: 0,
      },
      "cube-easeInOutQuint": {
        0: -2,
        1250: -1.9375,
        2500: 0,
        3750: 1.9375,
        5000: -2,
        7500: 0,
        10000: -2,
        12500: 0,
      },
      "cube-easeInOutElastic": {
        0: -2,
        1250: -1.9521222223050638,
        2500: 0,
        3750: 1.9521222223050638,
        5000: -2,
        7500: 0,
        10000: -2,
        12500: 0,
      },
      "cube-linear-ping-pong": {
        0: -2,
        1250: -1,
        2500: 0,
        3750: 1,
        5000: 2,
        7500: 0,
        10000: -2,
        12500: 0,
      },
      "cube-easeInOutQuint-ping-pong": {
        0: -2,
        1250: -1.9375,
        2500: 0,
        3750: 1.9375,
        5000: 2,
        7500: 0,
        10000: -2,
        12500: 0,
      },
      "cube-easeInOutElastic-ping-pong": {
        0: -2,
        1250: -1.9521222223050638,
        2500: 0,
        3750: 1.9521222223050638,
        5000: 2,
        7500: 0,
        10000: -2,
        12500: 0,
      },
    };

    async function assertPositionsAndScreenshotAtTime(time: number) {
      await setDocumentTime(page, time);
      await takeAndCompareScreenshot(page);

      for (const [id, expectedXForElementAtTimes] of Object.entries(expectedXPositions)) {
        const actualX = await page.evaluate((id) => {
          return (document.querySelector(`#${id}`) as any).getContainer().position.x;
        }, id);

        const expectedX =
          expectedXForElementAtTimes[time as keyof typeof expectedXForElementAtTimes];
        if (expectedX === undefined) {
          throw new Error(`No expected X position for ${id} at time ${time}`);
        }

        expect(`${id}: ${actualX} @ ${time}`).toEqual(`${id}: ${expectedX} @ ${time}`);
      }
    }

    await assertPositionsAndScreenshotAtTime(0);
    await assertPositionsAndScreenshotAtTime(1250);
    await assertPositionsAndScreenshotAtTime(2500);
    await assertPositionsAndScreenshotAtTime(3750);
    await assertPositionsAndScreenshotAtTime(5000);
    await assertPositionsAndScreenshotAtTime(10000);
    await assertPositionsAndScreenshotAtTime(12500);

    await page.close();
  }, 60000);
});
