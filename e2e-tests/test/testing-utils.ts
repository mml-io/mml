import * as puppeteer from "puppeteer";

declare global {
  interface Window {
    "mml-web-client": {
      mmlScene: {
        graphicsAdapter: {
          getBoundingBoxForElement(element: Element): {
            x: number;
            y: number;
            width: number;
            height: number;
          } | null;
        };
      };
      remoteDocumentWrapper: {
        overrideDocumentTime(documentTime: number): void;
      };
    };
  }
}

export async function clickElement(
  page: puppeteer.Page,
  selector: string,
  coordsOffset?: { x: number; y: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const coords = (await page.evaluate((selector: string) => {
    const { mmlScene } = window["mml-web-client"];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return mmlScene.graphicsAdapter.getBoundingBoxForElement(document.querySelector(selector)!);
  }, selector))!;

  const { x: xOffset, y: yOffset } = coordsOffset ?? { x: 0.5, y: 0.5 };
  return page.click("canvas", {
    offset: { x: coords.x + coords.width * xOffset, y: coords.y + coords.height * yOffset },
  });
}

export async function setDocumentTime(page: puppeteer.Page, documentTime: number) {
  await page.evaluate(async (documentTime: number) => {
    const { remoteDocumentWrapper } = window["mml-web-client"];
    remoteDocumentWrapper.overrideDocumentTime(documentTime);
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
