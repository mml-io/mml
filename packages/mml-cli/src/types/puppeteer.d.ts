// Type declaration for puppeteer when it's not installed
// This allows the dynamic import to work without type errors
declare module "puppeteer" {
  export function launch(options?: {
    headless?: boolean | "new";
    args?: string[];
    executablePath?: string;
    timeout?: number;
  }): Promise<Browser>;

  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    goto(url: string, options?: { waitUntil?: string | string[]; timeout?: number }): Promise<void>;
    setViewport(viewport: { width: number; height: number }): Promise<void>;
    screenshot(options?: {
      path?: string;
      type?: "png" | "jpeg" | "webp";
      fullPage?: boolean;
      clip?: { x: number; y: number; width: number; height: number };
    }): Promise<Buffer>;

    evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T>;

    waitForFunction(fn: () => boolean | any, options?: { timeout?: number }): Promise<void>;
    close(): Promise<void>;
  }
}
