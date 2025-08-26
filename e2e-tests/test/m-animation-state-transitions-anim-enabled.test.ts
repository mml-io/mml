import { navigateToTestPage, setDocumentTime, takeAndCompareScreenshot } from "./testing-utils";

describe("m-animation state transitions", () => {
  test("anim-enabled state transitions", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-animation-state-transitions-anim-enabled.test.html/reset");

    // Wait for models to load
    await page.waitForFunction(
      () => {
        const parentModel = document.getElementById("parent-model");
        const attachmentModel = document.getElementById("attachment-model");
        return (
          parentModel &&
          (parentModel as any).modelGraphics?.getBoundingBox() !== null &&
          attachmentModel &&
          (attachmentModel as any).modelGraphics?.getBoundingBox() !== null
        );
      },
      { timeout: 30000, polling: 100 },
    );

    // Wait for elements to be present
    await page.waitForSelector("#parent-model[anim-enabled='true'][anim]");
    await page.waitForSelector("#child-animation");

    // Step 1: Start with anim-enabled="true", anim attribute active
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim-enabled=true, anim=run (t=1000ms)");
    });
    await setDocumentTime(page, 1000);
    await takeAndCompareScreenshot(page);

    // Step 3: Set anim-enabled="false"
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.setAttribute("anim-enabled", "false");
    });
    await page.waitForSelector("#parent-model[anim-enabled='false']");

    // Step 4: Take screenshot (should show default pose)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim-enabled=false (default pose, t=1500ms)");
    });
    await setDocumentTime(page, 1500);
    await takeAndCompareScreenshot(page);

    // Step 5: Set anim-enabled="true"
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.setAttribute("anim-enabled", "true");
    });
    await page.waitForSelector("#parent-model[anim-enabled='true']");

    // Step 6: Take screenshot (should restore anim attribute)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim-enabled=true, anim=run restored (t=2000ms)");
    });
    await setDocumentTime(page, 2000);
    await takeAndCompareScreenshot(page);

    // Step 7: Remove anim attribute
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.removeAttribute("anim");
    });
    await page.waitForSelector("#parent-model:not([anim])");

    // Step 8: Take screenshot (should show child animations)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim removed, child idle w=1 (t=2500ms)");
    });
    await setDocumentTime(page, 2500);
    await takeAndCompareScreenshot(page);

    // Step 9: Set anim-enabled="false"
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.setAttribute("anim-enabled", "false");
    });
    await page.waitForSelector("#parent-model[anim-enabled='false']");

    // Step 10: Take screenshot (should show default pose)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim-enabled=false (default pose, t=3000ms)");
    });
    await setDocumentTime(page, 3000);
    await takeAndCompareScreenshot(page);

    // Step 11: Set anim-enabled="true"
    await page.evaluate(() => {
      const model = document.getElementById("parent-model")!;
      model.setAttribute("anim-enabled", "true");
    });
    await page.waitForSelector("#parent-model[anim-enabled='true']");

    // Step 12: Take screenshot (should restore child animations)
    await page.evaluate(() => {
      document
        .getElementById("state-label")!
        .setAttribute("content", "anim-enabled=true, child idle restored (t=3500ms)");
    });
    await setDocumentTime(page, 3500);
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);
});
