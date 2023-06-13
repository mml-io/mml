const { readFileSync } = require("fs");
const { resolve } = require("path");

let nvmrc;
try {
  nvmrc = readFileSync(resolve(process.cwd(), ".nvmrc"), { encoding: "utf8" });
} catch (e) {
  console.error("No .nvmrc file present");
  process.exit(1);
}

const currentVersion = process.version.trim();
const nvmrcVersion = nvmrc.trim();

if (currentVersion === nvmrcVersion) {
  console.log(`Node version matches: ${currentVersion}`);
} else {
  console.error(`Node version mismatch (${currentVersion} != ${nvmrcVersion}).`);
  console.log(`Run 'nvm install ${nvmrcVersion}' to resolve.`);
  process.exit(1);
}
