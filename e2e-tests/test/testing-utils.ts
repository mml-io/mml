import * as puppeteer from "puppeteer";

// Patterns that if they occur within a log message cause the message to be ignored
const ignoredMessages = new Set<string>(["No target node found for track"]);

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

// Store console messages for debugging
const consoleMessages: Array<{ type: string; text: string; timestamp: Date }> = [];

export function setupConsoleLogging(page: puppeteer.Page): void {
  // Inject error handling into the page to capture more detailed stack traces
  page.evaluateOnNewDocument(() => {
    const originalError = window.console.error;
    window.console.error = function (...args) {
      // Try to capture stack traces for error objects
      const enrichedArgs = args.map((arg) => {
        if (arg instanceof Error) {
          return `${arg.message}\nStack: ${arg.stack}`;
        }
        return arg;
      });
      originalError.apply(window.console, enrichedArgs);
    };

    // Capture unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason;
      if (error instanceof Error) {
        console.error(`Unhandled promise rejection: ${error.message}\nStack: ${error.stack}`);
      } else {
        console.error(`Unhandled promise rejection: ${error}`);
      }
    });
  });

  page.on("console", (msg) => {
    const message = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date(),
    };
    // If the message contains an ignored pattern, don't add it to the consoleMessages array
    for (const ignoredMessage of ignoredMessages) {
      if (message.text.includes(ignoredMessage)) {
        return;
      }
    }
    consoleMessages.push(message);

    // Also log to Node.js console for immediate visibility
    console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);

    // If it's an error, try to get additional details from the console message
    if (msg.type() === "error") {
      const args = msg.args();
      args.forEach(async (arg, index) => {
        try {
          const argValue = await arg.jsonValue();
          if (
            argValue &&
            typeof argValue === "object" &&
            "stack" in argValue &&
            typeof argValue.stack === "string"
          ) {
            console.error(`  Stack trace for arg ${index}:`);
            console.error(argValue.stack);
          }
        } catch {
          // Ignore errors when trying to extract stack traces
        }
      });
    }
  });

  page.on("pageerror", (err) => {
    const errorText = err.toString();
    const stackTrace = err.stack || "No stack trace available";

    const message = {
      type: "pageerror",
      text: `${errorText}\nStack: ${stackTrace}`,
      timestamp: new Date(),
    };
    consoleMessages.push(message);

    console.error(`[Browser ERROR] ${errorText}
      Stack trace: ${stackTrace}`);
  });

  page.on("requestfailed", (request) => {
    const message = {
      type: "requestfailed",
      text: `Failed to load ${request.url()}: ${request.failure()?.errorText}`,
      timestamp: new Date(),
    };
    consoleMessages.push(message);
    console.error(
      `[Browser NETWORK ERROR] Failed to load ${request.url()}: ${request.failure()?.errorText}`,
    );
  });
}

export function getRecentConsoleMessages(
  minutes: number = 1,
): Array<{ type: string; text: string; timestamp: Date }> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return consoleMessages.filter((msg) => msg.timestamp >= cutoff);
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

  // Set up console logging before navigation
  setupConsoleLogging(page);

  await page.goto(url);

  // Wait for the debug globals to be set to ensure the utils functions are available
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
      return `${defaultIdentifier}-${CURRENT_RENDERER}-snap`;
    },
  });
}

export async function readThreeSceneCounts(page: puppeteer.Page): Promise<{
  geometryCount: number;
  textureCount: number;
} | null> {
  return page.evaluate(() => {
    const adapter: any = (window as any)["mml-web-client"].mmlScene.getGraphicsAdapter();
    if (!adapter || typeof adapter.getThreeScene !== "function") {
      console.error("No adapter or adapter with getThreeScene function found");
      return null;
    }
    const scene = adapter.getThreeScene();

    return adapter.analyzeScene(scene).stats;
  });
}
