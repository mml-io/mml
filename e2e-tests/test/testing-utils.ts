import * as puppeteer from "puppeteer";

export async function clickElement(page: puppeteer.Page, selector: string) {
  const coords = await page.evaluate((selector: string) => {
    const { mmlScene } = window["mml-web-client"];
    return mmlScene.getBoundingBoxForElement(document.querySelector(selector));
  }, selector);

  return page.click("canvas", {
    offset: { x: coords.x + coords.width / 2, y: coords.y + coords.height / 2 },
  });
}

export async function takeAndCompareScreenshot(page: puppeteer.Page, threshold = 0.01) {
  expect(await page.screenshot()).toMatchImageSnapshot({
    failureThresholdType: "percent",
    failureThreshold: threshold,
  });
}
