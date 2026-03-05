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
      virtualRoot: any;
    };
  }
}

// Store console messages for debugging
const consoleMessages: Array<{ type: string; text: string; timestamp: Date }> = [];

// Virtual mode detection
const VIRTUAL_MODE = process.env.VIRTUAL === "true";

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

  page.on("pageerror", (err: any) => {
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
  const params: string[] = [];
  if (CURRENT_RENDERER === "playcanvas") {
    params.push("playcanvas");
  }
  if (VIRTUAL_MODE) {
    params.push("virtual=true");
  }
  return params.length > 0 ? `?${params.join("&")}` : "";
}

export async function clickElement(
  page: puppeteer.Page,
  selector: string,
  coordsOffset?: { x: number; y: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const coords = (await page.evaluate((selector: string) => {
    const { mmlScene } = window["mml-web-client"];
    // In virtual mode, query the virtual root; fall back to real DOM
    let element: any = null;
    const virtualRoot = window["mml-web-client"].virtualRoot;
    if (virtualRoot && typeof virtualRoot.querySelector === "function") {
      element = virtualRoot.querySelector(selector);
    }
    if (!element) {
      element = document.querySelector(selector);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return mmlScene.graphicsAdapter.getBoundingBoxForElement(element!);
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

/**
 * In virtual mode, inject a polyfill that intercepts document.querySelector and
 * document.querySelectorAll to delegate to the virtualRoot when available.
 * This allows test code inside page.evaluate / page.waitForFunction to find
 * MML elements that live in the virtual DOM tree instead of the real DOM.
 */
function setupVirtualModePolyfills(page: puppeteer.Page): void {
  page.evaluateOnNewDocument(() => {
    const origQuerySelector = document.querySelector.bind(document);
    const origQuerySelectorAll = document.querySelectorAll.bind(document);
    const origGetElementById = document.getElementById.bind(document);

    document.getElementById = function (id: string): any {
      const client = (window as any)["mml-web-client"];
      if (client && client.virtualRoot && typeof client.virtualRoot.querySelector === "function") {
        const virtualResult = client.virtualRoot.querySelector(`#${id}`);
        if (virtualResult) {
          return virtualResult;
        }
      }
      return origGetElementById(id);
    };

    document.querySelector = function (selector: string): any {
      const client = (window as any)["mml-web-client"];
      if (client && client.virtualRoot && typeof client.virtualRoot.querySelector === "function") {
        const virtualResult = client.virtualRoot.querySelector(selector);
        if (virtualResult) {
          return virtualResult;
        }
      }
      return origQuerySelector(selector);
    };

    document.querySelectorAll = function (selector: string): any {
      const client = (window as any)["mml-web-client"];
      if (
        client &&
        client.virtualRoot &&
        typeof client.virtualRoot.querySelectorAll === "function"
      ) {
        const virtualResults = client.virtualRoot.querySelectorAll(selector);
        if (virtualResults && virtualResults.length > 0) {
          return virtualResults;
        }
      }
      return origQuerySelectorAll(selector);
    };

    // Polyfill createElement/createTextNode to use the VirtualDocument when available.
    // Tests that call document.createElement("m-...") inside page.evaluate need to create
    // virtual elements, not real DOM elements, so they can be appended to the virtual tree.
    const origCreateElement = document.createElement.bind(document);
    (document as any).createElement = function (tagName: string, options?: any): any {
      if (
        tagName.startsWith("m-") &&
        (window as any)["mml-web-client"]?.virtualRoot?.ownerDocument?.createElement
      ) {
        return (window as any)["mml-web-client"].virtualRoot.ownerDocument.createElement(tagName);
      }
      return origCreateElement(tagName, options);
    };

    const origCreateTextNode = document.createTextNode.bind(document);
    (document as any).createTextNode = function (text: string): any {
      if ((window as any)["mml-web-client"]?.virtualRoot?.ownerDocument?.createTextNode) {
        return (window as any)["mml-web-client"].virtualRoot.ownerDocument.createTextNode(text);
      }
      return origCreateTextNode(text);
    };
  });
}

/**
 * In virtual mode, wrap page.waitForSelector to poll the virtualRoot instead
 * of using Puppeteer's native DOM-based waitForSelector. Most tests only use
 * the return value for synchronization, so returning null is acceptable.
 */
function wrapWaitForSelector(page: puppeteer.Page): void {
  const origWaitForSelector = page.waitForSelector.bind(page);
  (page as any).waitForSelector = async (
    selector: string,
    options?: { timeout?: number; visible?: boolean; hidden?: boolean },
  ) => {
    const timeout = options?.timeout ?? 30000;

    // For hidden/visible waitForSelector on real DOM elements, try the original first.
    // This handles overlay UI elements (buttons, inputs, divs) that live in the real DOM.
    if (options?.hidden || options?.visible) {
      try {
        return await origWaitForSelector(selector, {
          ...options,
          timeout: Math.min(timeout, 2000),
        });
      } catch {
        // Element not found in real DOM within short timeout; fall through to virtual polling
        if (options?.hidden) {
          return origWaitForSelector(selector, options);
        }
      }
    }

    // Poll virtualRoot and real DOM for the selector
    await page.waitForFunction(
      (sel: string) => {
        const client = (window as any)["mml-web-client"];
        if (
          client &&
          client.virtualRoot &&
          typeof client.virtualRoot.querySelector === "function"
        ) {
          if (client.virtualRoot.querySelector(sel) !== null) {
            return true;
          }
        }
        return document.querySelector(sel) !== null;
      },
      { timeout },
      selector,
    );

    // Try to get the real DOM element handle if it exists (for overlay elements)
    try {
      const handle = await page.$(selector);
      if (handle) return handle;
    } catch {
      // ignore
    }

    // Return a handle to the virtual element via the polyfilled document.querySelector.
    // This allows tests to call .evaluate() on the handle.
    try {
      const handle = await page.evaluateHandle(
        (sel: string) => document.querySelector(sel),
        selector,
      );
      if (handle) return handle;
    } catch {
      // ignore
    }

    return null;
  };
}

export async function navigateToTestPage(page: puppeteer.Page, testPath: string): Promise<void> {
  const url = `http://localhost:7079/${testPath}${getRendererUrlSuffix()}`;

  // Set up console logging before navigation
  setupConsoleLogging(page);

  // In virtual mode, inject polyfills before any page scripts run
  if (VIRTUAL_MODE) {
    setupVirtualModePolyfills(page);
    wrapWaitForSelector(page);
  }

  await page.goto(url);

  // Wait for the debug globals to be set to ensure the utils functions are available
  await page.waitForFunction(
    () => {
      return window["mml-web-client"] !== undefined;
    },
    { timeout: 15000 },
  );
}

export async function takeAndCompareScreenshot(page: puppeteer.Page, threshold = 0.025) {
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

export async function readThreeSceneRenderInfo(page: puppeteer.Page): Promise<{
  drawCalls: number;
  instancedMeshCount: number;
  totalInstanceCount: number;
  regularMeshCount: number;
} | null> {
  await renderFrame(page);
  return page.evaluate(() => {
    const adapter: any = (window as any)["mml-web-client"].mmlScene.getGraphicsAdapter();
    if (
      !adapter ||
      typeof adapter.getThreeScene !== "function" ||
      typeof adapter.getRenderer !== "function"
    ) {
      console.error("No adapter or adapter with getThreeScene/getRenderer function found");
      return null;
    }

    const scene = adapter.getThreeScene();
    const renderer = adapter.getRenderer();

    let instancedMeshCount = 0;
    let totalInstanceCount = 0;
    let regularMeshCount = 0;

    scene.traverse((object: any) => {
      if (object.isInstancedMesh) {
        instancedMeshCount++;
        totalInstanceCount += object.count;
      } else if (object.isMesh) {
        regularMeshCount++;
      }
    });

    return {
      drawCalls: renderer.info.render.calls,
      instancedMeshCount,
      totalInstanceCount,
      regularMeshCount,
    };
  });
}
