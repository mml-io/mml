import { clickElement, takeAndCompareScreenshot } from "./testing-utils";

describe("m-element-socket", () => {
  test("socketed element animation inheritance", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-model-socket-nest-test.html/reset");

    await page.waitForSelector("m-character");

    // Wait until the character is loaded
    await page.waitForFunction(
      () => {
        const character = document.querySelector("m-character");
        return (
          (character as any).getCharacter() !== null &&
          (character as any).getCurrentAnimation() !== null
        );
      },
      { timeout: 10000, polling: 100 },
    );

    await page.waitForSelector("m-model");

    await takeAndCompareScreenshot(page);

    await clickElement(page, "m-character");

    // Wait until reference cube is added
    await page.waitForFunction(
      () => {
        const group = document.getElementById("reference-objects");
        if (group) {
          const cube = group.querySelector("m-cube");
          const cubeMesh = (cube as any).getCube();
          return cubeMesh !== null;
        }
      },
      { timeout: 150000, polling: 100 },
    );
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
