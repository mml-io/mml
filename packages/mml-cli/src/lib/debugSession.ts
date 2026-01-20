/**
 * Debug Session Manager
 *
 * Manages a persistent Puppeteer browser session for taking screenshots,
 * executing client-side code, capturing browser logs, and other debugging operations.
 */

import fs from "fs";
import path from "path";

import { loadPuppeteer } from "./puppeteerLoader";

export interface DebugSessionOptions {
  host: string;
  port: number;
  headless?: boolean;
  onClientLog?: (entry: ClientLogEntry) => void;
}

export interface ClientLogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: unknown;
}

export interface ScreenshotOptions {
  /** Output file path */
  output?: string;
  /** Camera position { x, y, z } */
  cameraPosition?: { x: number; y: number; z: number };
  /** Camera look-at target { x, y, z } */
  cameraTarget?: { x: number; y: number; z: number };
  /** Viewport width */
  width?: number;
  /** Viewport height */
  height?: number;
  /** User ID to take screenshot from their perspective */
  userId?: string;
  /** Delay before taking screenshot (ms) */
  delay?: number;
}

export interface DebugSession {
  /** Take a screenshot of the game and save to file */
  screenshot(options?: ScreenshotOptions): Promise<string>;
  /** Take a screenshot and return as Buffer */
  screenshotBuffer(options?: Omit<ScreenshotOptions, "output">): Promise<Buffer>;
  /** Execute JavaScript in the browser context */
  clientExec(code: string): Promise<unknown>;
  /** Get the current camera position */
  getCameraPosition(): Promise<{ x: number; y: number; z: number } | null>;
  /** Get the DOM HTML from the client-side MML frame */
  getClientDom(): Promise<string>;
  /** Get list of elements from the client-side MML frame */
  getClientElements(
    type?: string,
  ): Promise<Array<{ tagName: string; id?: string; class?: string }>>;
  /** Refresh the browser page */
  refresh(): Promise<void>;
  /** Check if session is still connected */
  isConnected(): boolean;
  /** Close the session */
  close(): Promise<void>;
}

/**
 * Create a new debug session connected to the dev server
 */
export async function createDebugSession(options: DebugSessionOptions): Promise<DebugSession> {
  const pptr = await loadPuppeteer();

  const browser: any = await pptr.launch({
    headless: options.headless !== false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--allow-file-access-from-files",
    ],
  });

  const page: any = await browser.newPage();

  // Set default viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Hook into browser console to capture client logs
  if (options.onClientLog) {
    page.on("console", (msg: any) => {
      const type = msg.type();
      let level: ClientLogEntry["level"] = "info";
      if (type === "error") level = "error";
      else if (type === "warning") level = "warn";
      else if (type === "debug") level = "debug";

      // Get the message text and any additional args
      const text = msg.text();
      const args = msg.args();

      // Try to extract additional data from args beyond the first
      let data: unknown;
      if (args.length > 1) {
        // For multiple args, try to get their JSON values
        Promise.all(
          args.slice(1).map(async (arg: any) => {
            try {
              return await arg.jsonValue();
            } catch {
              return String(arg);
            }
          }),
        ).then((values) => {
          options.onClientLog?.({
            level,
            message: text,
            data: values.length === 1 ? values[0] : values,
          });
        });
      } else {
        options.onClientLog?.({ level, message: text, data });
      }
    });

    // Also capture page errors
    page.on("pageerror", (error: Error) => {
      options.onClientLog?.({
        level: "error",
        message: `Page error: ${error.message}`,
        data: error.stack,
      });
    });
  }

  const url = `http://${options.host}:${options.port}/`;

  const navigateAndWait = async () => {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for the game to load
    await page.waitForFunction(
      () => {
        // Check if the MML game client is initialized
        const w = window as unknown as { mmlClient?: unknown };
        return w.mmlClient !== undefined || document.querySelector("canvas") !== null;
      },
      { timeout: 30000 },
    );

    // Additional wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  // Initial navigation
  await navigateAndWait();

  const session: DebugSession = {
    async screenshot(screenshotOptions: ScreenshotOptions = {}): Promise<string> {
      const width = screenshotOptions.width || 1920;
      const height = screenshotOptions.height || 1080;

      await page.setViewport({ width, height });

      // Set camera position if specified
      if (screenshotOptions.cameraPosition || screenshotOptions.cameraTarget) {
        await page.evaluate(
          (
            pos: { x: number; y: number; z: number } | null,
            target: { x: number; y: number; z: number } | null,
          ) => {
            const w = window as unknown as {
              mmlClient?: {
                setDebugCamera?: (
                  pos?: { x: number; y: number; z: number },
                  target?: { x: number; y: number; z: number },
                ) => void;
              };
            };
            if (w.mmlClient?.setDebugCamera) {
              w.mmlClient.setDebugCamera(pos || undefined, target || undefined);
            }
          },
          screenshotOptions.cameraPosition || null,
          screenshotOptions.cameraTarget || null,
        );
        // Wait for camera to move
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Add delay if specified
      if (screenshotOptions.delay && screenshotOptions.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, screenshotOptions.delay));
      }

      // Determine output path
      let outputPath = screenshotOptions.output;
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        outputPath = `screenshot-${timestamp}.png`;
      }

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (dir && dir !== ".") {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Take screenshot
      await page.screenshot({
        path: outputPath,
        type: "png",
        fullPage: false,
      });

      return outputPath;
    },

    async screenshotBuffer(
      screenshotOptions: Omit<ScreenshotOptions, "output"> = {},
    ): Promise<Buffer> {
      const width = screenshotOptions.width || 1920;
      const height = screenshotOptions.height || 1080;

      await page.setViewport({ width, height });

      // Set camera position if specified
      if (screenshotOptions.cameraPosition || screenshotOptions.cameraTarget) {
        await page.evaluate(
          (
            pos: { x: number; y: number; z: number } | null,
            target: { x: number; y: number; z: number } | null,
          ) => {
            const w = window as unknown as {
              mmlClient?: {
                setDebugCamera?: (
                  pos?: { x: number; y: number; z: number },
                  target?: { x: number; y: number; z: number },
                ) => void;
              };
            };
            if (w.mmlClient?.setDebugCamera) {
              w.mmlClient.setDebugCamera(pos || undefined, target || undefined);
            }
          },
          screenshotOptions.cameraPosition || null,
          screenshotOptions.cameraTarget || null,
        );
        // Wait for camera to move
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Add delay if specified
      if (screenshotOptions.delay && screenshotOptions.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, screenshotOptions.delay));
      }

      // Take screenshot and return buffer
      const buffer = await page.screenshot({
        type: "png",
        fullPage: false,
        encoding: "binary",
      });

      return Buffer.from(buffer);
    },

    async clientExec(code: string): Promise<unknown> {
      return await page.evaluate((evalCode: string) => {
        // Execute in browser context using *indirect* eval to avoid bundler issues
        // (calling via a reference prevents "direct eval" semantics)
        const indirectEval = globalThis.eval as unknown as (c: string) => unknown;
        return indirectEval(evalCode);
      }, code);
    },

    async getCameraPosition(): Promise<{ x: number; y: number; z: number } | null> {
      return await page.evaluate(() => {
        const w = window as unknown as {
          mmlClient?: {
            getCameraPosition?: () => { x: number; y: number; z: number };
          };
        };
        if (w.mmlClient?.getCameraPosition) {
          return w.mmlClient.getCameraPosition();
        }
        return null;
      });
    },

    async getClientDom(): Promise<string> {
      return await page.evaluate(() => {
        // Find the MML iframe (the game content is rendered in an iframe)
        const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
        if (iframe?.contentDocument) {
          return iframe.contentDocument.documentElement?.outerHTML || "";
        }
        // Fallback: return the main document body if no iframe
        return document.body?.innerHTML || "";
      });
    },

    async getClientElements(
      type?: string,
    ): Promise<Array<{ tagName: string; id?: string; class?: string }>> {
      return await page.evaluate((selector: string) => {
        // Find the MML iframe
        const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument || document;

        const elements = doc.querySelectorAll(selector);
        const result: Array<{ tagName: string; id?: string; class?: string }> = [];

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          result.push({
            tagName: el.tagName?.toLowerCase(),
            id: el.id || undefined,
            class: el.className || undefined,
          });
        }

        return result;
      }, type || "[id], m-cube, m-sphere, m-cylinder, m-capsule, m-plane, m-model, m-character, m-group, m-light, m-label, m-audio, m-video, m-image");
    },

    async refresh(): Promise<void> {
      await navigateAndWait();
    },

    isConnected(): boolean {
      return browser.isConnected();
    },

    async close(): Promise<void> {
      await browser.close();
    },
  };

  return session;
}
