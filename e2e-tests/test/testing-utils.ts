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

// Store console messages for debugging
const consoleMessages: Array<{ type: string; text: string; timestamp: Date }> = [];

export function setupConsoleLogging(page: puppeteer.Page): void {
  // Inject error handling into the page to capture more detailed stack traces
  page.evaluateOnNewDocument(() => {
    const originalError = window.console.error;
    window.console.error = function(...args) {
      // Try to capture stack traces for error objects
      const enrichedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.message}\nStack: ${arg.stack}`;
        }
        return arg;
      });
      originalError.apply(window.console, enrichedArgs);
    };

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      if (error instanceof Error) {
        console.error(`Unhandled promise rejection: ${error.message}\nStack: ${error.stack}`);
      } else {
        console.error(`Unhandled promise rejection: ${error}`);
      }
    });
  });

  page.on('console', (msg) => {
    const message = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date()
    };
    consoleMessages.push(message);
    
    // Also log to Node.js console for immediate visibility
    console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
    
    // If it's an error, try to get additional details from the console message
    if (msg.type() === 'error') {
      const args = msg.args();
      args.forEach(async (arg, index) => {
        try {
          const argValue = await arg.jsonValue();
          if (argValue && typeof argValue === 'object' && 'stack' in argValue && typeof argValue.stack === 'string') {
            console.error(`  Stack trace for arg ${index}:`);
            console.error(argValue.stack);
          }
        } catch (e) {
          // Ignore errors when trying to extract stack traces
        }
      });
    }
  });

  page.on('pageerror', (err) => {
    const errorText = err.toString();
    const stackTrace = err.stack || 'No stack trace available';
    
    const message = {
      type: 'pageerror',
      text: `${errorText}\nStack: ${stackTrace}`,
      timestamp: new Date()
    };
    consoleMessages.push(message);
    
    console.error(`[Browser ERROR] ${errorText}`);
    console.error(`Stack trace:`);
    console.error(stackTrace);
  });

  page.on('requestfailed', (request) => {
    const message = {
      type: 'requestfailed',
      text: `Failed to load ${request.url()}: ${request.failure()?.errorText}`,
      timestamp: new Date()
    };
    consoleMessages.push(message);
    console.error(`[Browser NETWORK ERROR] Failed to load ${request.url()}: ${request.failure()?.errorText}`);
  });
}

export function getRecentConsoleMessages(minutes: number = 1): Array<{ type: string; text: string; timestamp: Date }> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return consoleMessages.filter(msg => msg.timestamp >= cutoff);
}

export function clearConsoleMessages(): void {
  consoleMessages.length = 0;
}

export async function createPageWithConsoleLogging(): Promise<puppeteer.Page> {
  const page = await __BROWSER_GLOBAL__.newPage();
  setupConsoleLogging(page);
  return page;
}

export async function waitForFunctionWithConsoleLogging<T>(
  page: puppeteer.Page,
  pageFunction: string | (((...args: any[]) => T | Promise<T>)),
  options?: { timeout?: number; polling?: number | "raf" | "mutation" },
  ...args: any[]
): Promise<puppeteer.JSHandle<T>> {
  try {
    return await page.waitForFunction(pageFunction, options, ...args);
  } catch (error) {
    // Get recent console messages to help debug the timeout
    const recentMessages = getRecentConsoleMessages(2);
    
    console.error(`❌ waitForFunction timeout on ${page.url()}`);
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Stack trace from test code:`);
    console.error(error instanceof Error && error.stack ? error.stack : 'No stack trace available');
    
    console.error(`Recent console messages (${recentMessages.length}):`);
    
    if (recentMessages.length === 0) {
      console.error('  No console messages captured');
    } else {
      recentMessages.forEach((msg, i) => {
        // Split multi-line messages (like those with stack traces) for better readability
        const lines = msg.text.split('\n');
        if (lines.length === 1) {
          console.error(`  ${i + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
        } else {
          console.error(`  ${i + 1}. [${msg.type.toUpperCase()}] ${lines[0]}`);
          lines.slice(1).forEach(line => {
            if (line.trim()) {
              console.error(`     ${line}`);
            }
          });
        }
      });
    }
    
    // Try to get additional debug info from the page
    try {
      const windowInfo = await page.evaluate(() => {
        return {
          documentReadyState: document.readyState,
          hasConsoleErrors: !!window.console?.error,
          location: window.location.href,
        };
      });
      console.error('Page debug info:', windowInfo);
    } catch (debugError) {
      console.error('Failed to get additional debug info:', debugError);
    }
    
    throw error;
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
  
  // Set up console logging before navigation
  setupConsoleLogging(page);
  
  console.log(`Navigating to: ${url}`);
  await page.goto(url);

  // Wait for the debug globals to be set to ensure the utils functions are available
  try {
    await page.waitForFunction(
      () => {
        return window["mml-web-client"] !== undefined;
      },
      { timeout: 5000 },
    );
  } catch (error) {
    // Get recent console messages to help debug the timeout
    const recentMessages = getRecentConsoleMessages(2);
    
    console.error(`❌ Timeout waiting for mml-web-client to be available on ${url}`);
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Stack trace from test code:`);
    console.error(error instanceof Error && error.stack ? error.stack : 'No stack trace available');
    
    console.error(`Recent console messages (${recentMessages.length}):`);
    
    if (recentMessages.length === 0) {
      console.error('  No console messages captured');
    } else {
      recentMessages.forEach((msg, i) => {
        // Split multi-line messages (like those with stack traces) for better readability
        const lines = msg.text.split('\n');
        if (lines.length === 1) {
          console.error(`  ${i + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
        } else {
          console.error(`  ${i + 1}. [${msg.type.toUpperCase()}] ${lines[0]}`);
          lines.slice(1).forEach(line => {
            if (line.trim()) {
              console.error(`     ${line}`);
            }
          });
        }
      });
    }
    
    // Try to get additional debug info from the page
    try {
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.error(`Page title: "${pageTitle}"`);
      console.error(`Final URL: ${pageUrl}`);
      
      // Check if basic window objects are available
      const windowInfo = await page.evaluate(() => {
        return {
          hasWindow: typeof window !== 'undefined',
          hasDocument: typeof document !== 'undefined',
          documentReadyState: document.readyState,
          windowKeys: Object.keys(window).filter(key => key.includes('mml')),
        };
      });
      console.error('Window debug info:', windowInfo);
      
    } catch (debugError) {
      console.error('Failed to get page debug info:', debugError);
    }
    
    throw error;
  }
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
