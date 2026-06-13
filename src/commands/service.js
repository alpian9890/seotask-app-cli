"use strict";

const { CliError } = require("../lib/errors");
const { serviceActiveStatus, serviceEnabledStatus, serviceUnitExists } = require("../lib/service");
const { taskStatusLine } = require("../lib/runner");

async function cmdService(args) {
  const action = args.action;
  if (action === "status") {
    const active = serviceActiveStatus();
    const enabled = serviceEnabledStatus();
    const { SERVICE_PATH } = require("../config/constants");
    console.log(`Service file: ${SERVICE_PATH}`);
    console.log(`Active: ${active}`);
    console.log(`Enabled: ${enabled}`);
    console.log(taskStatusLine());
    return ["active", "activating"].includes(active) ? 0 : 1;
  }
  const {
    cmdServiceInstall,
    cmdServiceStart,
    cmdServiceStop,
    cmdServiceRestart,
    cmdServiceUninstall,
  } = require("../lib/service");
  if (action === "install") return cmdServiceInstall();
  if (action === "start") return cmdServiceStart();
  if (action === "stop") return cmdServiceStop();
  if (action === "restart") return cmdServiceRestart();
  if (action === "uninstall") return cmdServiceUninstall();
  throw new CliError("Aksi service tidak dikenal.");
}

module.exports = { cmdService };