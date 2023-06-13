const { mkdir, writeFile } = require("fs").promises;
const os = require("os");
const path = require("path");

const puppeteer = require("puppeteer");

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

let headless = false;
if (process.env.HEADLESS === "true") {
  headless = true;
}

module.exports = async function () {
  const browser = await puppeteer.launch({
    headless: headless ? "new" : false,
  });
  // store the browser instance so we can teardown it later
  // this global is only available in the teardown but not in TestEnvironments
  globalThis.__BROWSER_GLOBAL__ = browser;

  // use the file system to expose the wsEndpoint for TestEnvironments
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, "wsEndpoint"), browser.wsEndpoint());
};
