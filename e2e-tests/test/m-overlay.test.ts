import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-overlay", () => {
  test("visible with different anchors", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-test.html/reset?allowOverlay=true");

    // Wait for Overlay elements to be present
    await page.waitForSelector("m-overlay");

    // Wait for the cube to be present as well
    await page.waitForSelector("m-cube");

    // Take screenshot to verify Overlay positioning
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("interactive elements can affect document state", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-test.html/reset?allowOverlay=true");

    // Wait for elements to be present
    await page.waitForSelector("#color-button");
    await page.waitForSelector("#test-cube");
    await page.waitForSelector("#status-text");

    // Verify initial state
    const initialColor = await page.evaluate(() => {
      const cube = document.getElementById("test-cube");
      return cube?.getAttribute("color");
    });
    expect(initialColor).toBe("red");

    const initialStatus = await page.evaluate(() => {
      const status = document.getElementById("status-text");
      return status?.textContent;
    });
    expect(initialStatus).toBe("Ready");

    // Click the Overlay button
    await page.click("#color-button");

    // Wait for changes to take effect
    await page.waitForFunction(() => {
      const cube = document.getElementById("test-cube");
      return cube?.getAttribute("color") !== "red";
    });

    // Verify the cube color changed
    const newColor = await page.evaluate(() => {
      const cube = document.getElementById("test-cube");
      return cube?.getAttribute("color");
    });
    expect(newColor).toBe("blue");

    // Verify the status text updated
    const newStatus = await page.evaluate(() => {
      const status = document.getElementById("status-text");
      return status?.textContent;
    });
    expect(newStatus).toBe("Color: blue");

    // Take screenshot to verify visual changes
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("dynamic content modification", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-overlay-test.html/reset?allowOverlay=true");

    // Wait for dynamic Overlay elements to be present
    await page.waitForSelector("#overlay-dynamic");
    await page.waitForSelector("#add-button");
    await page.waitForSelector("#modify-button");
    await page.waitForSelector("#remove-button");
    await page.waitForSelector("#action-status");

    // Take initial screenshot
    await takeAndCompareScreenshot(page);

    // Test adding an element
    await page.click("#add-button");

    // Wait for the new element to be added and status to update
    await page.waitForSelector("#added-circle");
    await page.waitForFunction(() => {
      const status = document.getElementById("action-status");
      return status?.textContent === "Added circle";
    });

    // Take screenshot with added element
    await takeAndCompareScreenshot(page);

    // Test modifying text content
    await page.click("#modify-button");

    // Wait for text change and status update
    await page.waitForFunction(() => {
      const content = document.getElementById("dynamic-content");
      const status = document.getElementById("action-status");
      return content?.textContent === "Modified Content" && status?.textContent === "Modified text";
    });

    // Take screenshot with modified text
    await takeAndCompareScreenshot(page);

    // Test removing the added element
    await page.click("#remove-button");

    // Wait for element to be removed and status update
    await page.waitForFunction(() => {
      const circle = document.getElementById("added-circle");
      const status = document.getElementById("action-status");
      return !circle && status?.textContent === "Removed circle";
    });

    // Take final screenshot with element removed
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
