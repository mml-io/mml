import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-overlay hierarchy", () => {
  test("basic page load and elements present", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-hierarchy-test.html/reset?allowOverlay=true");

    // Wait for overlay and initial elements to be present
    await page.waitForSelector("m-overlay");
    await page.waitForSelector("#hierarchy-overlay");
    await page.waitForSelector("#level-1");
    await page.waitForSelector("#add-level-2");
    await page.waitForSelector("#add-sibling");
    await page.waitForSelector("#remove-all");
    await page.waitForSelector("#status");

    // Take initial screenshot
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("add and remove nested hierarchy levels", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-hierarchy-test.html/reset?allowOverlay=true");

    // Wait for overlay and initial elements to be present
    await page.waitForSelector("m-overlay");
    await page.waitForSelector("#hierarchy-overlay");
    await page.waitForSelector("#add-level-2");

    // Verify initial state
    const initialState = await page.evaluate(() => {
      const level1 = document.getElementById("level-1");
      return {
        level1Exists: level1 !== null,
        level1Children: level1 ? level1.children.length : 0,
      };
    });
    expect(initialState.level1Exists).toBe(true);

    // Click to add a Level 2 container
    await page.click("#add-level-2");

    // Wait for and verify Level 2 was added
    await page.waitForSelector("#level-2-1");
    const level2Exists = await page.evaluate(() => {
      return document.getElementById("level-2-1") !== null;
    });
    expect(level2Exists).toBe(true);

    // Click to add a Level 3 container inside Level 2
    await page.click('[data-parent="level-2-1"]');

    // Wait for and verify Level 3 was added
    await page.waitForSelector("#level-3-1");
    const level3Exists = await page.evaluate(() => {
      return document.getElementById("level-3-1") !== null;
    });
    expect(level3Exists).toBe(true);

    // Take screenshot with nested hierarchy
    await takeAndCompareScreenshot(page);

    // Click to remove Level 3
    await page.click('[data-target="level-3-1"]');

    // Verify Level 3 was removed
    await page.waitForFunction(() => {
      return document.getElementById("level-3-1") === null;
    });

    const level3Removed = await page.evaluate(() => {
      return document.getElementById("level-3-1") === null;
    });
    expect(level3Removed).toBe(true);

    await page.close();
  }, 60000);

  test("add and remove sibling containers", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-hierarchy-test.html/reset?allowOverlay=true");

    // Wait for elements to be present
    await page.waitForSelector("#add-sibling");

    // Click to add first sibling container
    await page.click("#add-sibling");

    // Wait for first sibling to be added
    await page.waitForSelector("#sibling-1");

    // Click to add second sibling container
    await page.click("#add-sibling");

    // Wait for second sibling to be added
    await page.waitForSelector("#sibling-2");

    // Verify both siblings exist
    const siblingsExist = await page.evaluate(() => {
      const sibling1 = document.getElementById("sibling-1");
      const sibling2 = document.getElementById("sibling-2");
      return sibling1 !== null && sibling2 !== null;
    });
    expect(siblingsExist).toBe(true);

    // Take screenshot with siblings
    await takeAndCompareScreenshot(page);

    // Click to remove first sibling
    await page.click('[data-target="sibling-1"]');

    await page.waitForFunction(() => {
      return document.getElementById("sibling-1") === null;
    });

    // Verify first sibling removed but second remains
    const siblingState = await page.evaluate(() => {
      const sibling1 = document.getElementById("sibling-1");
      const sibling2 = document.getElementById("sibling-2");
      return { sibling1Removed: sibling1 === null, sibling2Exists: sibling2 !== null };
    });
    expect(siblingState.sibling1Removed).toBe(true);
    expect(siblingState.sibling2Exists).toBe(true);

    await page.close();
  }, 60000);

  test("remove all dynamic elements", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-hierarchy-test.html/reset?allowOverlay=true");

    // Wait for elements to be present
    await page.waitForSelector("#add-level-2");
    await page.waitForSelector("#add-sibling");
    await page.waitForSelector("#remove-all");

    // Click to add Level 2
    await page.click("#add-level-2");
    await page.waitForSelector("#level-2-1");

    // Click to add Level 3 inside Level 2
    await page.click('[data-parent="level-2-1"]');
    await page.waitForSelector("#level-3-1");

    // Click to add sibling
    await page.click("#add-sibling");
    await page.waitForSelector("#sibling-1");

    // Verify all elements exist
    const elementsExist = await page.evaluate(() => {
      return {
        level2: document.getElementById("level-2-1") !== null,
        level3: document.getElementById("level-3-1") !== null,
        sibling: document.getElementById("sibling-1") !== null,
      };
    });
    expect(elementsExist.level2).toBe(true);
    expect(elementsExist.level3).toBe(true);
    expect(elementsExist.sibling).toBe(true);

    // Click to remove all dynamic elements
    await page.click("#remove-all");

    // Wait for all elements to be removed
    await page.waitForFunction(() => {
      const level2 = document.getElementById("level-2-1");
      const level3 = document.getElementById("level-3-1");
      const sibling = document.getElementById("sibling-1");
      return level2 === null && level3 === null && sibling === null;
    });

    // Verify all dynamic elements are removed
    const elementsRemoved = await page.evaluate(() => {
      return {
        level2: document.getElementById("level-2-1") === null,
        level3: document.getElementById("level-3-1") === null,
        sibling: document.getElementById("sibling-1") === null,
      };
    });
    expect(elementsRemoved.level2).toBe(true);
    expect(elementsRemoved.level3).toBe(true);
    expect(elementsRemoved.sibling).toBe(true);

    // Take final screenshot
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
