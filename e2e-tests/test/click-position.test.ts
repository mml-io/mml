import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-plane position click", () => {
  test("can get right position on click", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/click-position-test.html/reset");

    await page.waitForSelector("m-plane");

    await takeAndCompareScreenshot(page);

    const labelSelector = await page.waitForSelector("m-label");
    const labelContent = (await labelSelector?.evaluate((el) => el.getAttribute("content")))!;

    await clickElement(page, "m-plane");

    // Wait for the label to update
    await page.waitForFunction(
      (labelSelector, labelContent) => {
        return labelSelector?.getAttribute("content") !== labelContent;
      },
      {},
      labelSelector,
      labelContent,
    );

    const labelContentAfterClick = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedTitle = JSON.parse(labelContentAfterClick);
    const { x, y, z } = parsedTitle;

    expect(parseFloat(x)).toBeLessThanOrEqual(0.1);
    expect(parseFloat(x)).toBeGreaterThanOrEqual(-0.1);
    expect(parseFloat(y)).toBeLessThanOrEqual(0.1);
    expect(parseFloat(y)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(z)).toBeCloseTo(0, 1);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("can get right position on click with offset", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/click-position-test.html/reset");

    await page.waitForSelector("m-plane");

    await takeAndCompareScreenshot(page);

    const labelSelector = await page.waitForSelector("m-label");
    const labelContent = (await labelSelector?.evaluate((el) => el.getAttribute("content")))!;

    // Clicking in the bottom left quadrant
    await clickElement(page, "m-plane", { x: 0.25, y: 0.75 });

    // Wait for the label to update
    await page.waitForFunction(
      (labelSelector, labelContent) => {
        return labelSelector?.getAttribute("content") !== labelContent;
      },
      {},
      labelSelector,
      labelContent,
    );

    const labelContentExample1 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample1 = JSON.parse(labelContentExample1);
    const { x: xE1, y: yE1, z: zE1 } = parsedLabelExample1;

    expect(parseFloat(xE1)).toBeLessThanOrEqual(-2.49);
    expect(parseFloat(xE1)).toBeGreaterThanOrEqual(-2.51);
    expect(parseFloat(yE1)).toBeLessThanOrEqual(-2.49);
    expect(parseFloat(yE1)).toBeGreaterThanOrEqual(-2.51);
    expect(parseFloat(zE1)).toEqual(0);

    // Clicking in the bottom right quadrant
    await clickElement(page, "m-plane", { x: 0.75, y: 0.75 });

    // Wait for the label to update
    await page.waitForFunction(
      (labelSelector, labelContent) => {
        return labelSelector?.getAttribute("content") !== labelContent;
      },
      {},
      labelSelector,
      labelContentExample1,
    );

    const labelContentExample2 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample2 = JSON.parse(labelContentExample2);
    const { x: xE2, y: yE2, z: zE2 } = parsedLabelExample2;

    expect(parseFloat(xE2)).toBeLessThanOrEqual(2.51);
    expect(parseFloat(xE2)).toBeGreaterThanOrEqual(2.49);
    expect(parseFloat(yE2)).toBeLessThanOrEqual(-2.49);
    expect(parseFloat(yE2)).toBeGreaterThanOrEqual(-2.51);
    expect(parseFloat(zE2)).toEqual(0);

    // Clicking in the top left quadrant
    await clickElement(page, "m-plane", { x: 0.25, y: 0.25 });

    // Wait for the label to update
    await page.waitForFunction(
      (labelSelector, labelContent) => {
        return labelSelector?.getAttribute("content") !== labelContent;
      },
      {},
      labelSelector,
      labelContentExample2,
    );

    const labelContentExample3 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample3 = JSON.parse(labelContentExample3);
    const { x: xE3, y: yE3, z: zE3 } = parsedLabelExample3;

    expect(parseFloat(xE3)).toBeLessThanOrEqual(-2.49);
    expect(parseFloat(xE3)).toBeGreaterThanOrEqual(-2.51);
    expect(parseFloat(yE3)).toBeLessThanOrEqual(2.51);
    expect(parseFloat(yE3)).toBeGreaterThanOrEqual(2.49);
    expect(parseFloat(zE3)).toEqual(0);

    // Clicking in the top right quadrant
    await clickElement(page, "m-plane", { x: 0.75, y: 0.25 });

    // Wait for the label to update
    await page.waitForFunction(
      (labelSelector, labelContent) => {
        return labelSelector?.getAttribute("content") !== labelContent;
      },
      {},
      labelSelector,
      labelContentExample3,
    );

    const labelContentExample4 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample4 = JSON.parse(labelContentExample4);
    const { x: xE4, y: yE4, z: zE4 } = parsedLabelExample4;

    expect(parseFloat(xE4)).toBeLessThanOrEqual(2.51);
    expect(parseFloat(xE4)).toBeGreaterThanOrEqual(2.49);
    expect(parseFloat(yE4)).toBeLessThanOrEqual(2.51);
    expect(parseFloat(yE4)).toBeGreaterThanOrEqual(2.49);
    expect(parseFloat(zE4)).toEqual(0);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
