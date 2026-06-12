"use strict";

const {
  CLI_VERSION,
} = require("../config/constants");
const {
  releaseArchText,
  binaryPath,
  configDir,
} = require("../lib/utils");

async function cmdVersion() {
  console.log(`SeoTask App CLI ${CLI_VERSION}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Arch: ${releaseArchText()}`);
  console.log(`Binary: ${binaryPath()}`);
  console.log(`Config: ${configDir()}`);
  return 0;
}

module.exports = { cmdVersion };