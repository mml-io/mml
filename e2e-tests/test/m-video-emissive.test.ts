import { setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-video-emissive", () => {
  test("emissive property of videos", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-video-emissive-test.html/reset");

    // Wait for the m-video content to load
    await page.waitForFunction(
      () => {
        const videoMesh = (document.querySelector("m-video") as any).getVideoMesh();
        return videoMesh.scale.y > 3 && videoMesh.scale.x > 3;
      },
      { timeout: 30000, polling: 100 },
    );

    await setDocumentTime(page, 10000);

    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
