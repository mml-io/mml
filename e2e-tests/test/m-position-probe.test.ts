import * as puppeteer from "puppeteer";

import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-position-probe", () => {
  test("receives user positions", async () => {
    const page = (await globalThis.__BROWSER_GLOBAL__.newPage()) as puppeteer.Page;

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-position-probe-test.html/reset");

    await page.waitForSelector("m-position-probe");

    await page.waitForSelector("#toggle-range-cube");

    await takeAndCompareScreenshot(page);

    await clickElement(page, "#toggle-range-cube");

    await page.waitForSelector("m-cube[data-test-id='user-cube']");

    const { x: x1, z: z1 } = await page.evaluate(() => {
      const userCube = document.querySelector("m-cube[data-test-id='user-cube']");
      const x = parseFloat(userCube.getAttribute("x"));
      const z = parseFloat(userCube.getAttribute("z"));
      return { x, z };
    });
    expect(x1).toBeLessThan(-3.7);
    expect(x1).toBeGreaterThan(-3.9);
    expect(z1).toBeGreaterThan(3.5);
    expect(z1).toBeLessThan(3.6);

    await takeAndCompareScreenshot(page);

    await clickElement(page, "#toggle-position-cube");

    await page.waitForFunction(
      () => {
        const userCube = document.querySelector("m-cube[data-test-id='user-cube']");
        // Wait for the cube to move based on the position probe moving
        return parseFloat(userCube.getAttribute("x")) > -2;
      },
      { timeout: 30000, polling: 100 },
    );

    const { x: x2, z: z2 } = await page.evaluate(() => {
      const userCube = document.querySelector("m-cube[data-test-id='user-cube']");
      const x = parseFloat(userCube.getAttribute("x"));
      const z = parseFloat(userCube.getAttribute("z"));
      return { x, z };
    });
    expect(x2).toBeLessThan(-1.1);
    expect(x2).toBeGreaterThan(-1.3);
    expect(z2).toBeGreaterThan(5);
    expect(z2).toBeLessThan(5.1);

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
