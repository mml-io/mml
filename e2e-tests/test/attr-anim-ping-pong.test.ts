import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim ping-pong", () => {
  test("animations can ping-pong", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-anim-ping-pong.html/reset");

    await page.waitForSelector("m-attr-anim[attr='x']");

    const expectedXPositions = {
      "ping-pong": {
        0: -5,
        500: -3,
        1000: -1,
        2500: 5,
        5000: -5,
        10000: -5,
      },
      "ping-pong-delay": {
        0: -5,
        500: -5,
        1000: -1.666666666666666,
        2500: 5,
        5000: -5,
        10000: -5,
      },
      "ping-pong-looping": {
        0: -5,
        500: -3,
        1000: -1,
        2500: 5,
        5000: -5,
        10000: -5,
      },
      "ping-pong-delay-looping": {
        0: -5,
        500: -5,
        1000: -1.666666666666666,
        2500: 5,
        5000: -5,
        10000: -5,
      },
      "ping-pong-paused": {
        0: -5,
        500: -5,
        1000: -1.666666666666666,
        2500: -1.666666666666666,
        5000: -1.666666666666666,
        10000: -1.666666666666666,
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
    await assertPositionsAndScreenshotAtTime(500);
    await assertPositionsAndScreenshotAtTime(1000);
    await assertPositionsAndScreenshotAtTime(2500);
    await assertPositionsAndScreenshotAtTime(5000);
    await assertPositionsAndScreenshotAtTime(10000);

    await page.close();
  }, 60000);
});
