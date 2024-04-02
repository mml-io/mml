import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-frame", () => {
  test("load-range", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-frame-load-range-test.html/reset");

    await page.waitForSelector("m-frame");

    // Should not have the frame contents loaded yet
    await takeAndCompareScreenshot(page);

    {
      // Put the frame into the load range and wait for it to load
      await clickElement(page, "#set-into-range-label");

      await page.waitForSelector("m-frame[z='5']");

      // Wait for the m-image inside the static content to load
      await page.waitForFunction(
        () => {
          return (document.querySelector("m-image") as any)?.getImageMesh().scale.y > 3;
        },
        { timeout: 10000, polling: 100 },
      );

      expect(await page.evaluate(() => document.querySelectorAll("m-image").length)).toEqual(1);

      // Frame should be loaded
      await takeAndCompareScreenshot(page);
    }

    // Putting the frame into the unload range should not unload it
    {
      await clickElement(page, "#set-into-unload-range-label");

      await page.waitForSelector("m-frame[z='2']");

      // Wait for 1 second to ensure the frame is re-evaluated
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(await page.evaluate(() => document.querySelectorAll("m-image").length)).toEqual(1);

      // Frame should still be loaded
      await takeAndCompareScreenshot(page);
    }

    // Putting the frame outside the load range should unload it
    {
      await clickElement(page, "#set-into-outside-range-label");

      await page.waitForSelector("m-frame[z='0']");

      // Wait for 1 second to ensure the frame is re-evaluated
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(await page.evaluate(() => document.querySelectorAll("m-image").length)).toEqual(0);

      // Frame should now be unloaded
      await takeAndCompareScreenshot(page);
    }

    // Putting the frame into the range between load-range and unload-range should not load it if it not already loaded
    {
      await clickElement(page, "#set-into-unload-range-label");

      await page.waitForSelector("m-frame[z='2']");

      // Wait for 1 second to ensure the frame is re-evaluated
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(await page.evaluate(() => document.querySelectorAll("m-image").length)).toEqual(0);

      // Frame should now be unloaded
      await takeAndCompareScreenshot(page);
    }

    await page.close();
  }, 60000);
});
