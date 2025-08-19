import { clickElement, navigateToTestPage, takeAndCompareScreenshot } from "./testing-utils";

describe("m-element-socket", () => {
  test("socketed element position", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-model-socket-test.html/reset");

    await page.waitForSelector("m-character");

    // Wait until the character is loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (
          (character as any).modelGraphics.hasLoadedModel() &&
          (character as any).modelGraphics.hasLoadedAnimation()
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await clickElement(page, "m-cube");

    await page.waitForSelector("m-cube[socket='hand_l']");

    // socketed m-cube position should match the left hand bone position
    let [xPos, yPos, zPos] = await page.evaluate(() => {
      const cube = document.getElementById("socketed-cube") as any;
      const { x, y, z } = cube.getWorldPosition();
      return [x, y, z];
    });
    await takeAndCompareScreenshot(page);
    expect(Math.abs(xPos - 0.814)).toBeLessThan(0.01);
    expect(Math.abs(yPos - 4.503)).toBeLessThan(0.01);
    expect(Math.abs(zPos - 0.307)).toBeLessThan(0.01);

    await clickElement(page, "m-cube");

    await page.waitForSelector("m-cube[socket='hand_r']");

    // socketed m-cube position should match the right hand bone position
    [xPos, yPos, zPos] = await page.evaluate(() => {
      const cube = document.getElementById("socketed-cube") as any;
      const { x, y, z } = cube.getWorldPosition();
      return [x, y, z];
    });
    await takeAndCompareScreenshot(page);
    expect(Math.abs(xPos - -1.836)).toBeLessThan(0.01);
    expect(Math.abs(yPos - 4.193)).toBeLessThan(0.01);
    expect(Math.abs(zPos - -0.331)).toBeLessThan(0.01);

    await clickElement(page, "m-cube");

    await page.waitForSelector("m-cube[socket='']");

    // socketed m-cube position should match its parent origin (0, 0, 0)
    [xPos, yPos, zPos] = await page.evaluate(() => {
      const cube = document.getElementById("socketed-cube") as any;
      const { x, y, z } = cube.getWorldPosition();
      return [x, y, z];
    });
    await takeAndCompareScreenshot(page);
    expect(xPos).toBeLessThan(0.01);
    expect(yPos).toBeLessThan(0.01);
    expect(zPos).toBeLessThan(0.01);

    await clickElement(page, "m-cube");

    await page.waitForSelector("m-cube[socket='head']");

    // socketed m-cube position should match the head bone position
    [xPos, yPos, zPos] = await page.evaluate(() => {
      const cube = document.getElementById("socketed-cube") as any;
      const { x, y, z } = cube.getWorldPosition();
      return [x, y, z];
    });
    expect(xPos).toBeLessThan(0.01);
    expect(Math.abs(yPos - 7.978)).toBeLessThan(0.01);
    expect(zPos).toBeLessThan(0.01);

    await page.close();
  }, 60000);
});
