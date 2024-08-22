import { promises as fs } from "fs";
import os from "os";
import path from "path";

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");
module.exports = async function () {
  // close the browser instance
  __BROWSER_GLOBAL__.close();

  // clean-up the wsEndpoint file
  await fs.rm(DIR, { recursive: true, force: true });
};
