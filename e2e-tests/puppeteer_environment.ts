import { readFileSync } from "node:fs";

import { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import { TestEnvironment as NodeEnvironment } from "jest-environment-node";
import os from "os";
import path from "path";
import puppeteer from "puppeteer";

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

export default class PuppeteerEnvironment extends NodeEnvironment {
  constructor(config: JestEnvironmentConfig, environmentContext: EnvironmentContext) {
    super(config, environmentContext);
  }

  async setup() {
    await super.setup();
    // get the wsEndpoint
    const wsEndpoint = readFileSync(path.join(DIR, "wsEndpoint"), { encoding: "utf8" });
    if (!wsEndpoint) {
      throw new Error("wsEndpoint not found");
    }

    // connect to puppeteer
    this.global.__BROWSER_GLOBAL__ = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
    });
  }

  async teardown() {
    if (this.global.__BROWSER_GLOBAL__) {
      (this.global.__BROWSER_GLOBAL__ as any).disconnect();
    }
    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }
}
