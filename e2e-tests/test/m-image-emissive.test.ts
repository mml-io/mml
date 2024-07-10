import { takeAndCompareScreenshot } from "./testing-utils";

describe("m-image-emissive", () => {
  test("image emissive parameters", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-image-emissive-test.html/reset");

    // Wait for the m-image content to load
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-image") as any).every(
          (img: any) => img.getImageMesh().scale.y > 3,
        );
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
