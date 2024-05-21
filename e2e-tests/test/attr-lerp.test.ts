import { clickElement, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

type ExpectedStates = { [key: string]: { x: number; height: number } };

describe("m-attr-lerp", () => {
  test("lerping is applied according to attributes", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-lerp.html/reset");

    await page.waitForSelector("m-attr-lerp[attr='x']");

    async function testExpectedStates(expectedStates: ExpectedStates) {
      for (const [id, expected] of Object.entries(expectedStates)) {
        const actualX = await page.evaluate((id) => {
          return (document.querySelector(`#${id}`) as any).getContainer().position.x;
        }, id);

        const actualHeight = await page.evaluate((id) => {
          return (document.querySelector(`#${id}`) as any).getCube().scale.y;
        }, id);

        expect(`${id}: x: ${actualX} height: ${actualHeight}`).toEqual(
          `${id}: x: ${expected.x} height: ${expected.height}`,
        );
      }
    }

    // Set the document time to 0 to use as a reference point for the start of the lerping
    await setDocumentTime(page, 0);

    await testExpectedStates({
      "two-independent-attributes": { x: -4.25, height: 0.5 },
      "combined-attributes-shadowed": { x: -4.25, height: 0.5 },
      "combined-attributes-overridden": { x: -4.25, height: 0.5 },
      "all-attributes": { x: -4.25, height: 0.5 },
      "all-attributes-default": { x: -4.25, height: 0.5 },
      "no-attributes": { x: -4.25, height: 0.5 },
    });

    await takeAndCompareScreenshot(page);

    // Click all of the cubes to trigger the lerping
    await clickElement(page, "#two-independent-attributes");
    await clickElement(page, "#combined-attributes-shadowed");
    await clickElement(page, "#combined-attributes-overridden");
    await clickElement(page, "#all-attributes");
    await clickElement(page, "#all-attributes-default");
    await clickElement(page, "#no-attributes");

    // Set the document time to 1000 to check the lerping
    await setDocumentTime(page, 1000);

    await testExpectedStates({
      "two-independent-attributes": { x: -2.125, height: 0.3 },
      "combined-attributes-shadowed": { x: -2.125, height: 0.4 },
      "combined-attributes-overridden": { x: 0, height: 0.4 },
      "all-attributes": { x: 0, height: 0.3 },
      "all-attributes-default": { x: 0, height: 0.3 },
      "no-attributes": { x: 4.25, height: 0.1 },
    });

    await takeAndCompareScreenshot(page);

    // Set the document time to 1000 to check the lerping
    await setDocumentTime(page, 5000);

    await testExpectedStates({
      "two-independent-attributes": { x: 4.25, height: 0.1 },
      "combined-attributes-shadowed": { x: 4.25, height: 0.1 },
      "combined-attributes-overridden": { x: 4.25, height: 0.1 },
      "all-attributes": { x: 4.25, height: 0.1 },
      "all-attributes-default": { x: 4.25, height: 0.1 },
      "no-attributes": { x: 4.25, height: 0.1 },
    });

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
