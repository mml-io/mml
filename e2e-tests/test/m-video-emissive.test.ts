import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-video-emissive", () => {
  test("emissive property of videos", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-video-emissive-test.html/reset");

    // Wait for the m-video content to load
    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("m-video") as any).every((video: any) => {
          if (!video || !video.videoGraphics) {
            return false;
          }
          const { width, height } = video.videoGraphics.getWidthAndHeight();
          return width > 1 || height > 1;
        });
      },
      { timeout: 5000, polling: 100 },
    );

    await setDocumentTime(page, 10000);

    await takeAndCompareScreenshot(page, 0.02);

    await page.close();
  }, 60000);
});
