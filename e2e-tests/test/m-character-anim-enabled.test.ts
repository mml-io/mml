import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-character", () => {
  test("animation enabled toggle", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-character-anim-test.html/reset");

    await page.waitForSelector("m-character");

    // Wait until the character is loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (
          (character as any).modelGraphics.hasLoadedModel() !== null &&
          (character as any).modelGraphics.getBoundingBox() !== null &&
          (character as any).modelGraphics.hasLoadedAnimation() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await page.waitForSelector("m-model");

    // click cube to set anim-enabled from true to false
    await clickElement(page, "m-cube");

    // Wait for label update: anim-enabled="false"
    await page.waitForFunction(
      () =>
        document.getElementById("anim-label")?.getAttribute("content") === 'anim-enabled="false"',
      { timeout: 5000, polling: 100 },
    );

    // screenshot
    await takeAndCompareScreenshot(page);

    // click cube again to set anim-enabled back from false to true
    await clickElement(page, "m-cube");

    // Wait for label update: anim-enabled="true"
    await page.waitForFunction(
      () =>
        document.getElementById("anim-label")?.getAttribute("content") === 'anim-enabled="true"',
      { timeout: 5000, polling: 100 },
    );

    // Wait until the character and animation are loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (character as any).modelGraphics.hasLoadedAnimation() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    // screenshot
    await takeAndCompareScreenshot(page);

    // click cylinder to remove "anim" attribute
    await clickElement(page, "m-cylinder");

    // Wait for label update: anim removed
    await page.waitForFunction(
      () => document.getElementById("anim-label")?.getAttribute("content") === "anim removed",
      { timeout: 5000, polling: 100 },
    );

    // screenshot
    await takeAndCompareScreenshot(page);

    // click cylinder again to add "anim" attribute back
    await clickElement(page, "m-cylinder");

    // Wait for label update: anim="/assets/idle.glb"
    await page.waitForFunction(
      () =>
        document.getElementById("anim-label")?.getAttribute("content") ===
        'anim="/assets/idle.glb"',
      { timeout: 5000, polling: 100 },
    );

    // Wait until the character and animation are loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (
          (character as any).modelGraphics.hasLoadedModel() !== null &&
          (character as any).modelGraphics.getBoundingBox() !== null &&
          (character as any).modelGraphics.hasLoadedAnimation() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
