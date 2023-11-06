import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-plane position click", () => {
  test("can get right position on click", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/click-position-test.html");

    await page.waitForSelector("m-plane");

    await takeAndCompareScreenshot(page);

    await clickElement(page, "m-plane");

    const textSelector = await page.waitForSelector("m-label");
    const labelContent = (await textSelector?.evaluate((el) => el.getAttribute("content")))!;
    const parsedTitle = JSON.parse(labelContent);
    const { x, y, z } = parsedTitle;

    expect(x).toBeLessThan(0.1);
    expect(x).toBeGreaterThan(-0.1);
    expect(y).toBeLessThan(0.1);
    expect(y).toBeGreaterThan(0);
    expect(z).toEqual(0);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("can get right position on click with offset", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/click-position-test.html");

    await page.waitForSelector("m-plane");

    await takeAndCompareScreenshot(page);

    // Clicking in the bottom left quadrant
    await clickElement(page, "m-plane", { x: 0.25, y: 0.75 });

    const labelSelector = await page.waitForSelector("m-label");
    const labelContentExample1 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample1 = JSON.parse(labelContentExample1);
    const { x: xE1, y: yE1, z: zE1 } = parsedLabelExample1;

    expect(xE1).toBeLessThan(-2.5);
    expect(xE1).toBeGreaterThan(-2.51);
    expect(yE1).toBeLessThan(-2.49);
    expect(yE1).toBeGreaterThan(-2.5);
    expect(zE1).toEqual(0);

    // Clicking in the bottom right quadrant
    await clickElement(page, "m-plane", { x: 0.75, y: 0.75 });

    const labelContentExample2 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample2 = JSON.parse(labelContentExample2);
    const { x: xE2, y: yE2, z: zE2 } = parsedLabelExample2;

    expect(xE2).toBeLessThan(2.51);
    expect(xE2).toBeGreaterThan(2.5);
    expect(yE2).toBeLessThan(-2.49);
    expect(yE2).toBeGreaterThan(-2.5);
    expect(zE2).toEqual(0);

    // Clicking in the top left quadrant
    await clickElement(page, "m-plane", { x: 0.25, y: 0.25 });

    const labelContentExample3 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample3 = JSON.parse(labelContentExample3);
    const { x: xE3, y: yE3, z: zE3 } = parsedLabelExample3;

    expect(xE3).toBeLessThan(-2.5);
    expect(xE3).toBeGreaterThan(-2.51);
    expect(yE3).toBeLessThan(2.5);
    expect(yE3).toBeGreaterThan(2.49);
    expect(zE3).toEqual(0);

    // Clicking in the top right quadrant
    await clickElement(page, "m-plane", { x: 0.75, y: 0.25 });

    const labelContentExample4 = (await labelSelector?.evaluate((el) =>
      el.getAttribute("content"),
    ))!;
    const parsedLabelExample4 = JSON.parse(labelContentExample4);
    const { x: xE4, y: yE4, z: zE4 } = parsedLabelExample4;

    expect(xE4).toBeLessThan(2.51);
    expect(xE4).toBeGreaterThan(2.5);
    expect(yE4).toBeLessThan(2.5);
    expect(yE4).toBeGreaterThan(2.49);
    expect(zE4).toEqual(0);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
