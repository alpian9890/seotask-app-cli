"use strict";

const {
  CLI_VERSION,
  SERVICE_NAME,
  SERVICE_PATH,
} = require("../config/constants");
const {
  binaryPath,
  configDir,
  canWriteDir,
  fileStatus,
  fingerprintPath,
  telegramPath,
  sessionPath,
  credentialsPath,
  statePath,
  earningsPath,
  logPath,
  releaseArchText,
  runSystemctl,
  serviceStatusValue,
} = require("../lib/utils");
const { DEFAULT_UA } = require("../config/constants");
const { httpRequest } = require("../lib/http");
const { taskStatusLine } = require("../lib/runner");
const { WEBAPP_URL } = require("../config/constants");

async function cmdDoctor() {
  const checks = [];
  const add = (name, value) => checks.push([name, value]);
  add("Version", CLI_VERSION);
  add("Platform", `${process.platform} ${releaseArchText()}`);
  add("Binary", binaryPath());
  add("Config", `${configDir()} (${canWriteDir(configDir()) ? "writable" : "tidak writable"})`);
  add("Fingerprint", fileStatus(fingerprintPath()));
  add("Telegram", fileStatus(telegramPath()));
  add("Session", fileStatus(sessionPath()));
  add("Credentials", fileStatus(credentialsPath()));
  add("State", fileStatus(statePath()));
  add("Earnings", fileStatus(earningsPath()));
  add("Log", fileStatus(logPath()));

  const systemd = runSystemctl(["is-system-running"]);
  const systemdText = (systemd.stdout || systemd.stderr || "").trim();
  add("Systemd", systemd.error || systemdText.includes("System has not been booted with systemd") ? "tidak tersedia" : "tersedia");
  add("Service active", serviceStatusValue("is-active"));
  add("Service enabled", serviceStatusValue("is-enabled"));

  try {
    const response = await httpRequest(WEBAPP_URL, {
      method: "GET",
      headers: { "User-Agent": DEFAULT_UA, Accept: "text/html,*/*" },
      timeout: 10,
      retries: 1,
      maxBodyBytes: 50000,
    });
    add("Network", response.status < 500 ? `OK (HTTP ${response.status})` : `bermasalah (HTTP ${response.status})`);
  } catch (error) {
    add("Network", `bermasalah (${error.message || error})`);
  }

  console.log("SeoTask Doctor");
  console.log("");
  for (const [name, value] of checks) console.log(`${name}: ${value}`);
  console.log("");
  console.log(taskStatusLine());
  return 0;
}

module.exports = { cmdDoctor };