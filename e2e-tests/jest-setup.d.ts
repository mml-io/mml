import * as puppeteer from "puppeteer";
export {};
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(): R;
    }
  }

  export const __BROWSER_GLOBAL__: puppeteer.Browser;
}
