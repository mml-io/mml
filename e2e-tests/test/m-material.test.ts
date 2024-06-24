import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-material", () => {
  test("materials load and unload", async () => {
    const labelCoords = {
      createCube: { x: 110, y: 180 },
      removeCube: { x: 315, y: 180 },
      cube2: { x: 330, y: 880 },
      cube3: { x: 510, y: 880 },
    };
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-test.html/reset");

    await page.waitForSelector("m-label");

    await page.click("canvas", { offset: labelCoords.createCube });
    await page.waitForSelector("m-group[data-loaded-materials='1']");

    await takeAndCompareScreenshot(page);
    for (let i = 0; i < 4; i++) {
      await page.click("canvas", { offset: labelCoords.createCube });
    }
    await page.waitForSelector("m-group[data-loaded-materials='5']");
    await takeAndCompareScreenshot(page);

    // Click to remove the m-child from a couple cubes
    await page.click("canvas", { offset: labelCoords.cube2 });
    await page.click("canvas", { offset: labelCoords.cube3 });
    await page.waitForSelector("m-group[data-loaded-materials='3']");
    await takeAndCompareScreenshot(page);

    for (let i = 0; i < 5; i++) {
      await page.click("canvas", { offset: labelCoords.removeCube });
    }

    await page.waitForSelector("m-group[data-loaded-materials='0']");
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("materials work with any primitive", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-primitives-test.html/reset");

    await page.waitForSelector("m-group");

    await page.waitForSelector("m-group[data-loaded-materials='5']");

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
