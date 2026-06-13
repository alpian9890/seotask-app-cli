"use strict";

const fs = require("fs");
const {
  MAX_LOG_LINES,
} = require("../config/constants");
const {
  ensureConfigDir,
  logPath,
  readLogLines,
  sleep,
} = require("../lib/utils");
const { runnerIsActive, currentCountdownText } = require("../lib/runner");

function printEmptyLogMessage() {
  console.log("Log masih kosong, silahkan jalankan task terlebih dulu");
}

async function cmdLogLive() {
  let lines = readLogLines().slice(-MAX_LOG_LINES);
  if (!lines.length && !runnerIsActive()) {
    printEmptyLogMessage();
    return 1;
  }
  if (lines.length) console.log(lines.join("\n"));
  let lastLength = lines.length;
  let lastCountdown = "";

  while (runnerIsActive()) {
    await sleep(1000);
    lines = readLogLines().slice(-MAX_LOG_LINES);
    if (lines.length < lastLength) lastLength = 0;
    if (lines.length > lastLength) {
      if (lastCountdown) {
        process.stdout.write("\r\x1b[K");
        lastCountdown = "";
      }
      console.log(lines.slice(lastLength).join("\n"));
      lastLength = lines.length;
    }
    const { readJson, statePath } = require("../lib/utils");
    const state = readJson(statePath()) || {};
    const countdown = currentCountdownText(state) || "";
    if (countdown !== lastCountdown) {
      process.stdout.write(`\r\x1b[K${countdown}`);
      lastCountdown = countdown;
    }
  }
  if (lastCountdown) process.stdout.write("\n");
  return 0;
}

async function cmdLog(args) {
  if (args.action === "live") return cmdLogLive();
  if (args.action === "clear") {
    ensureConfigDir();
    fs.writeFileSync(logPath(), "", { encoding: "utf8", mode: 0o600 });
    console.log(`Log dikosongkan: ${logPath()}`);
    return 0;
  }
  const lines = readLogLines().slice(-MAX_LOG_LINES);
  if (!lines.length) {
    printEmptyLogMessage();
    return 1;
  }
  console.log(lines.join("\n"));
  return 0;
}

module.exports = { cmdLog };