import { renderFrame, takeAndCompareScreenshot } from "./testing-utils";

describe("m-attr-anim color", () => {
  test("parse color attributes including floating point and scientific notation", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/attr-color.html/reset");

    // Wait for all m-cube and m-label elements to be present
    await page.waitForFunction(
      () => {
        const cubes = document.querySelectorAll("m-cube");
        const labels = document.querySelectorAll("m-label");
        return cubes.length === 64 && labels.length === 66; // 64 cubes/labels and 2 extra edge case labels
      },
      { timeout: 30000, polling: 100 },
    );

    await renderFrame(page);

    await takeAndCompareScreenshot(page, 0.03);

    await page.close();
  }, 60000);
});
