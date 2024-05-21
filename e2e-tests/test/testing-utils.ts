import * as puppeteer from "puppeteer";

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    "mml-web-client": {
      mmlScene: {
        getBoundingBoxForElement(element: Element): {
          x: number;
          y: number;
          width: number;
          height: number;
        } | null;
      };
      remoteDocuments: Array<{
        overrideDocumentTime(documentTime: number): void;
      }>;
    };
  }
}

export async function clickElement(
  page: puppeteer.Page,
  selector: string,
  coordsOffset?: { x: number; y: number },
) {
  const coords = (await page.evaluate((selector: string) => {
    const { mmlScene } = window["mml-web-client"];
    return mmlScene.getBoundingBoxForElement(document.querySelector(selector)!);
  }, selector))!;

  const { x: xOffset, y: yOffset } = coordsOffset ?? { x: 0.5, y: 0.5 };
  return page.click("canvas", {
    offset: { x: coords.x + coords.width * xOffset, y: coords.y + coords.height * yOffset },
  });
}

export async function setDocumentTime(page: puppeteer.Page, documentTime: number) {
  await page.evaluate(async (documentTime: number) => {
    const { remoteDocuments } = window["mml-web-client"];
    for (const remoteDocument of remoteDocuments) {
      remoteDocument.overrideDocumentTime(documentTime);
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }, documentTime);
}

export async function takeAndCompareScreenshot(page: puppeteer.Page, threshold = 0.011) {
  expect(await page.screenshot()).toMatchImageSnapshot({
    failureThresholdType: "percent",
    failureThreshold: threshold,
  });
}
