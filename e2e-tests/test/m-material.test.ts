import { takeAndCompareScreenshot } from "./testing-utils";

const labelCoords = {
  createCube: { x: 110, y: 180 },
  removeCube: { x: 315, y: 180 },
  switchMaterialType: { x: 510, y: 180 },
  cube2: { x: 330, y: 880 },
  cube3: { x: 510, y: 880 },
};

const sharedMaterialTestCoords = {
  test1: { x: 115, y: 180 },
  test2: { x: 315, y: 180 },
  test3: { x: 505, y: 180 },
  test4: { x: 710, y: 180 },
  test5: { x: 910, y: 180 },
};

const frameTestCoords = {
  removeRootMaterial: { x: 512, y: 377 },
  createCube: { x: 328, y: 595 },
  removeCube: { x: 424, y: 596 },
  switchMaterialType: { x: 512, y: 596 },
  cube1: { x: 423, y: 768 },
  cube2: { x: 508, y: 763 },
  cube3: { x: 591, y: 751 },
  test1: { x: 292, y: 141 },
  test2: { x: 401, y: 145 },
  test3: { x: 511, y: 144 },
  test4: { x: 625, y: 143 },
  test5: { x: 732, y: 143 },
};

describe("m-material", () => {
  test("materials load and unload", async () => {
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

    await page.waitForSelector("m-group[data-loaded-materials='4']");

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("use shared material", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-test.html/reset");

    await page.waitForSelector("m-label");

    for (let i = 0; i < 5; i++) {
      await page.click("canvas", { offset: labelCoords.createCube });
    }
    await page.waitForSelector("m-group[data-loaded-materials='5']");
    await takeAndCompareScreenshot(page);

    await page.click("canvas", { offset: labelCoords.switchMaterialType });
    await page.waitForSelector("m-group[data-loaded-materials='1']");
    await takeAndCompareScreenshot(page);

    // Remove material id from a couple cubes
    await page.click("canvas", { offset: labelCoords.cube2 });
    await page.click("canvas", { offset: labelCoords.cube3 });
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("Removing child with material-id set should fallback to shared material", async () => {
    const coords = {
      test1: { x: 115, y: 180 },
      test2: { x: 315, y: 180 },
    };
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-priority-test.html/reset");

    await page.waitForSelector("#container");

    await page.click("canvas", { offset: coords.test1 });

    await page.waitForSelector("m-group[data-test-step='0']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='1']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='2']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='-1']");
    await page.close();
  }, 60000);

  test("Removing material-id should not affect child", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-priority-test.html/reset");

    await page.waitForSelector("#container");

    await page.click("canvas", { offset: sharedMaterialTestCoords.test2 });

    await page.waitForSelector("m-group[data-test-step='0']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='1']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='2']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='-1']");
    await page.close();
  }, 60000);

  test("Adding material-id should not affect child", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-priority-test.html/reset");

    await page.waitForSelector("#container");

    await page.click("canvas", { offset: sharedMaterialTestCoords.test3 });

    await page.waitForSelector("m-group[data-test-step='0']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='1']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='2']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='-1']");
    await page.close();
  }, 60000);

  test("Child material should replace shared material", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-priority-test.html/reset");

    await page.waitForSelector("#container");

    await page.click("canvas", { offset: sharedMaterialTestCoords.test4 });

    await page.waitForSelector("m-group[data-test-step='0']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='1']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='2']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='-1']");
    await page.close();
  }, 60000);

  test("Non-unique material ids should respect the order in the document", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-priority-test.html/reset");

    await page.waitForSelector("#container");

    await page.click("canvas", { offset: sharedMaterialTestCoords.test5 });

    await page.waitForSelector("m-group[data-test-step='0']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='1']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='2']");
    await takeAndCompareScreenshot(page);

    await page.waitForSelector("m-group[data-test-step='-1']");
    await page.close();
  }, 60000);

  test("shared materials should be isolated by their documents", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-material-test.html/reset");
    await page.goto("http://localhost:7079/m-material-priority-test.html/reset");
    await page.goto("http://localhost:7079/m-material-frame-test.html/reset");

    await page.waitForSelector("m-frame[src='ws://localhost:7079/m-material-test.html']");
    for (let i = 0; i < 20; i++) {
      await page.click("canvas", { offset: frameTestCoords.createCube });
    }

    await page.waitForSelector("m-group[data-loaded-materials='20']");
    await page.click("canvas", { offset: frameTestCoords.switchMaterialType });
    await page.waitForSelector("m-group[data-loaded-materials='1']");

    await page.click("canvas", { offset: frameTestCoords.cube1 });
    await page.click("canvas", { offset: frameTestCoords.cube2 });
    await page.click("canvas", { offset: frameTestCoords.cube3 });
    await takeAndCompareScreenshot(page);

    const tests = [
      frameTestCoords.test1,
      frameTestCoords.test2,
      frameTestCoords.test3,
      frameTestCoords.test4,
      frameTestCoords.test5,
    ];
    for (let i = 0; i < tests.length; i++) {
      await page.click("canvas", { offset: tests[i] });

      await page.waitForSelector("m-group[data-test-step='0']");
      await takeAndCompareScreenshot(page);

      await page.waitForSelector("m-group[data-test-step='1']");
      await takeAndCompareScreenshot(page);

      await page.waitForSelector("m-group[data-test-step='2']");
      await takeAndCompareScreenshot(page);

      await page.waitForSelector("m-group[data-test-step='-1']");
    }

    // Test root
    await page.click("canvas", { offset: frameTestCoords.removeRootMaterial });
    await takeAndCompareScreenshot(page);

    await page.click("canvas", { offset: frameTestCoords.removeRootMaterial });
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
