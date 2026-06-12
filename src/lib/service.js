"use strict";

const fs = require("fs");

const {
  SERVICE_NAME,
  SERVICE_PATH,
  INSTALL_PATH,
} = require("../config/constants");
const { CliError } = require("./errors");
const { runSystemctl, isRoot } = require("./utils");

function serviceUnitExists() {
  return fs.existsSync(SERVICE_PATH);
}

function serviceActiveStatus() {
  return (runSystemctl(["is-active", SERVICE_NAME]).stdout || "").trim() || "unknown";
}

function serviceEnabledStatus() {
  return (runSystemctl(["is-enabled", SERVICE_NAME]).stdout || "").trim() || "unknown";
}

function serviceUnitText() {
  return `[Unit]
Description=SeoTask CLI Runner
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/seotask start
ExecStop=/usr/local/bin/seotask stop
Restart=on-failure
RestartSec=8
TimeoutStopSec=45
Environment=SEOTASK_SERVICE=1
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
`;
}

async function cmdServiceInstall(args) {
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  fs.writeFileSync(SERVICE_PATH, serviceUnitText(), "utf8");
  runSystemctl(["daemon-reload"]);
  const enable = runSystemctl(["enable", "--now", SERVICE_NAME]);
  if (enable.status !== 0) throw new CliError((enable.stderr || "").trim() || "Gagal enable/start service.");
  console.log(`Service terpasang: ${SERVICE_PATH}`);
  console.log("Service aktif dan auto-start saat VPS reboot.");
  return 0;
}

async function cmdServiceStart() {
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  const start = runSystemctl(["start", SERVICE_NAME]);
  if (start.status !== 0) throw new CliError((start.stderr || "").trim() || "Gagal start service.");
  console.log("Service dimulai.");
  return 0;
}

async function cmdServiceStop() {
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  const { readJson, atomicWriteJson, statePath, nowUtc } = require("./utils");
  const state = readJson(statePath()) || {};
  Object.assign(state, { running: false, stopped_at: nowUtc(), current_task_running: false, last_status: "STOP", last_message: "Service stop" });
  atomicWriteJson(statePath(), state);
  const stop = runSystemctl(["stop", SERVICE_NAME]);
  if (stop.status !== 0) throw new CliError((stop.stderr || "").trim() || "Gagal stop service.");
  console.log("Service dihentikan.");
  return 0;
}

async function cmdServiceRestart() {
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  const { readJson, atomicWriteJson, statePath, nowUtc } = require("./utils");
  const state = readJson(statePath()) || {};
  Object.assign(state, { running: false, stopped_at: nowUtc(), current_task_running: false, last_status: "STOP", last_message: "Service restart" });
  atomicWriteJson(statePath(), state);
  const restart = runSystemctl(["restart", SERVICE_NAME]);
  if (restart.status !== 0) throw new CliError((restart.stderr || "").trim() || "Gagal restart service.");
  console.log("Service direstart.");
  return 0;
}

async function cmdServiceUninstall() {
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  runSystemctl(["disable", "--now", SERVICE_NAME]);
  try {
    fs.unlinkSync(SERVICE_PATH);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  runSystemctl(["daemon-reload"]);
  console.log("Service dihapus.");
  return 0;
}

module.exports = {
  serviceUnitExists,
  serviceActiveStatus,
  serviceEnabledStatus,
  serviceUnitText,
  cmdServiceInstall,
  cmdServiceStart,
  cmdServiceStop,
  cmdServiceRestart,
  cmdServiceUninstall,
};