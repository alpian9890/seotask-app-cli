"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  APP_NAME,
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

function lookupUser(username) {
  const name = String(username || "").trim();
  if (!name) return null;
  const result = spawnSync("getent", ["passwd", name], { encoding: "utf8" });
  if (result.status === 0 && result.stdout) {
    const parts = result.stdout.trim().split(":");
    return {
      user: parts[0],
      uid: parts[2],
      gid: parts[3],
      home: parts[5],
    };
  }
  try {
    const info = os.userInfo();
    if (info.username === name) {
      return { user: info.username, uid: String(info.uid), gid: String(info.gid), home: info.homedir };
    }
  } catch (_) {}
  return null;
}

function lookupGroup(gid) {
  const value = String(gid || "").trim();
  if (!value) return "";
  const result = spawnSync("getent", ["group", value], { encoding: "utf8" });
  if (result.status === 0 && result.stdout) return result.stdout.trim().split(":")[0] || "";
  return "";
}

function safeSystemdName(value, label) {
  const text = String(value || "").trim();
  if (!/^[A-Za-z0-9_.@-]+$/.test(text)) throw new CliError(`${label} tidak valid untuk systemd: ${text}`);
  return text;
}

function systemdEnvLine(key, value) {
  const escaped = String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  return `Environment="${key}=${escaped}"`;
}

function resolveServiceTarget() {
  const requestedUser = String(process.env.SEOTASK_SERVICE_USER || "").trim();
  let username = requestedUser;
  if (!username && isRoot()) {
    const sudoUser = String(process.env.SUDO_USER || "").trim();
    if (sudoUser && sudoUser !== "root") username = sudoUser;
  }
  if (!username) {
    try {
      username = os.userInfo().username;
    } catch (_) {
      username = "root";
    }
  }

  const userInfo = lookupUser(username);
  if (!userInfo) throw new CliError(`User service tidak ditemukan: ${username}`);
  const user = safeSystemdName(userInfo.user, "User");
  const groupName = lookupGroup(userInfo.gid);
  const group = groupName ? safeSystemdName(groupName, "Group") : "";
  const home = path.resolve(process.env.SEOTASK_SERVICE_HOME || userInfo.home || os.homedir());
  const config = path.resolve(process.env.SEOTASK_HOME || path.join(home, ".config", APP_NAME));
  return { user, group, home, config };
}

function readInstalledServiceTarget() {
  let text = "";
  try {
    text = fs.readFileSync(SERVICE_PATH, "utf8");
  } catch (_) {
    return null;
  }
  const target = {};
  const userMatch = text.match(/^User=(.+)$/m);
  if (userMatch) target.user = userMatch[1].trim();
  const groupMatch = text.match(/^Group=(.+)$/m);
  if (groupMatch) target.group = groupMatch[1].trim();
  const workdirMatch = text.match(/^WorkingDirectory=(.+)$/m);
  if (workdirMatch) target.home = workdirMatch[1].trim();
  for (const match of text.matchAll(/^Environment="?([^="\s]+)=([^"\n]*)"?$/gm)) {
    if (match[1] === "HOME") target.home = match[2];
    if (match[1] === "SEOTASK_HOME") target.config = match[2];
  }
  return Object.keys(target).length ? target : null;
}

function applyInstalledServiceEnv() {
  const target = readInstalledServiceTarget();
  if (!target) return null;
  if (target.home) process.env.HOME = target.home;
  if (target.config) process.env.SEOTASK_HOME = target.config;
  return target;
}

function serviceUnitText(target = resolveServiceTarget()) {
  const user = safeSystemdName(target.user, "User");
  const group = target.group ? safeSystemdName(target.group, "Group") : "";
  return `[Unit]
Description=SeoTask CLI Runner
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
${group ? `Group=${group}\n` : ""}WorkingDirectory=${target.home}
ExecStart=/usr/local/bin/seotask start
ExecStop=/usr/local/bin/seotask stop
Restart=on-failure
RestartSec=8
TimeoutStopSec=45
${systemdEnvLine("HOME", target.home)}
${systemdEnvLine("SEOTASK_HOME", target.config)}
${systemdEnvLine("SEOTASK_SERVICE", "1")}
${systemdEnvLine("PYTHONUNBUFFERED", "1")}

[Install]
WantedBy=multi-user.target
`;
}

async function cmdServiceInstall(args) {
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  const target = resolveServiceTarget();
  fs.writeFileSync(SERVICE_PATH, serviceUnitText(target), "utf8");
  runSystemctl(["daemon-reload"]);
  const enable = runSystemctl(["enable", "--now", SERVICE_NAME]);
  if (enable.status !== 0) throw new CliError((enable.stderr || "").trim() || "Gagal enable/start service.");
  console.log(`Service terpasang: ${SERVICE_PATH}`);
  console.log(`Service user: ${target.user}`);
  console.log(`Service HOME: ${target.home}`);
  console.log(`Service config: ${target.config}`);
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
  applyInstalledServiceEnv();
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
  applyInstalledServiceEnv();
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
  readInstalledServiceTarget,
  applyInstalledServiceEnv,
  serviceUnitText,
  cmdServiceInstall,
  cmdServiceStart,
  cmdServiceStop,
  cmdServiceRestart,
  cmdServiceUninstall,
};
