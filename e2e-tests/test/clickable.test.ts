import { clickElement, navigateToTestPage, takeAndCompareScreenshot } from "./testing-utils";

describe("clickable attribute", () => {
  test("clickable=false allows click-through to cube", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "clickable-test.html/reset");

    await page.waitForSelector("#label");
    await page.waitForSelector("#toggle-button");
    const stateLabel = await page.waitForSelector("#state-label");

    await takeAndCompareScreenshot(page);

    const getCounts = async () => {
      const content = (await stateLabel?.evaluate((el) => el.getAttribute("content")))!;
      const match = content.match(/Cube Clicks: (\d+), Label Clicks: (\d+)/);
      if (!match) {
        throw new Error(`Unexpected state label content: ${content}`);
      }
      return { cube: parseInt(match[1], 10), label: parseInt(match[2], 10) };
    };

    // Initial state should be 0,0
    const initial = await getCounts();
    expect(initial.cube).toBe(0);
    expect(initial.label).toBe(0);

    // Explicitly set clickable=true on the label first
    await page.evaluate(() => {
      const label = document.querySelector("#label");
      label?.setAttribute("clickable", "true");
    });

    // Click the label initially (default clickable=true)
    await clickElement(page, "#label");

    await page.waitForFunction(
      (prevContent) => {
        const el = document.querySelector("#state-label");
        return el?.getAttribute("content") !== prevContent;
      },
      {},
      await stateLabel?.evaluate((el) => el.getAttribute("content")),
    );

    const afterInitialClick = await getCounts();
    expect(afterInitialClick.cube).toBe(0);
    expect(afterInitialClick.label).toBe(1);

    await takeAndCompareScreenshot(page);

    // Toggle the label to be non-clickable
    await clickElement(page, "#toggle-button");
    await page.waitForFunction(() => {
      const el = document.querySelector("#label");
      return el?.getAttribute("clickable") === "false";
    });

    // Click where the label is; with clickable=false this should pass through to the cube
    await clickElement(page, "#label");

    await page.waitForFunction(
      (prevContent) => {
        const el = document.querySelector("#state-label");
        return el?.getAttribute("content") !== prevContent;
      },
      {},
      await stateLabel?.evaluate((el) => el.getAttribute("content")),
    );

    const afterClickthrough = await getCounts();
    expect(afterClickthrough.cube).toBe(1);
    expect(afterClickthrough.label).toBe(1);

    await takeAndCompareScreenshot(page);

    // Toggle the label back to be clickable
    await clickElement(page, "#toggle-button");
    await page.waitForFunction(() => {
      const el = document.querySelector("#label");
      return el?.getAttribute("clickable") === "true";
    });

    // Click where the label is; with clickable=true this should hit the label
    await clickElement(page, "#label");

    await page.waitForFunction(
      (prevContent) => {
        const el = document.querySelector("#state-label");
        return el?.getAttribute("content") !== prevContent;
      },
      {},
      await stateLabel?.evaluate((el) => el.getAttribute("content")),
    );

    const afterToggleBack = await getCounts();
    expect(afterToggleBack.cube).toBe(1);
    expect(afterToggleBack.label).toBe(2);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
