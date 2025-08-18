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

// Get the current renderer from environment variable
const CURRENT_RENDERER = (process.env.RENDERER || "threejs") as "threejs" | "playcanvas";

function getRendererUrlSuffix(): string {
  return CURRENT_RENDERER === "playcanvas" ? "?playcanvas" : "";
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

export async function renderFrame(page: puppeteer.Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

export async function navigateToTestPage(page: puppeteer.Page, testPath: string): Promise<void> {
  const url = `http://localhost:7079/${testPath}${getRendererUrlSuffix()}`;
  await page.goto(url);

  // Wait for the debug globals to be set
  await page.waitForFunction(
    () => {
      return window["mml-web-client"] !== undefined;
    },
    { timeout: 5000 },
  );
}

export async function takeAndCompareScreenshot(page: puppeteer.Page, threshold = 0.02) {
  await renderFrame(page);
  expect(await page.screenshot()).toMatchImageSnapshot({
    failureThresholdType: "percent",
    failureThreshold: threshold,
    customSnapshotIdentifier: ({ defaultIdentifier }) => {
      // Transform the default identifier to include renderer
      // Default format: "test-file-ts-describe-block-test-name-1"
      // New format: "test-file-ts-describe-block-test-name-1-{renderer}-snap"
      return `${defaultIdentifier}-${CURRENT_RENDERER}-snap`;
    },
  });
}
