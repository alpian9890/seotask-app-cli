"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  CLI_VERSION,
  DEFAULT_UA,
  SERVICE_NAME,
  SERVICE_PATH,
  TELEGRAM_SERVICE_NAME,
  TELEGRAM_TIMER_NAME,
  TELEGRAM_SERVICE_PATH,
  TELEGRAM_TIMER_PATH,
  INSTALL_PATH,
} = require("../config/constants");
const { CliError } = require("./errors");
const {
  nowUtc,
  atomicWriteJson,
  readJson,
  telegramPath,
  statePath,
  logPath,
  earningsPath,
  configDir,
  lastRelevantLogLine,
  formatHumanDate,
  normalizeTimezone,
  datePartsInTimezone,
  previousDateKeyInTimezone,
  formatDateKeyHuman,
  roundRub,
  commandExists,
  systemdAvailable,
  runSystemctl,
} = require("./utils");
const { httpRequest } = require("./http");

// ─── Telegram config ─────────────────────────────────────────────────────────
function loadTelegramConfig(required = false) {
  const data = readJson(telegramPath());
  if (!data) {
    if (required) throw new CliError("Telegram belum diset. Jalankan `seotask telegram setup` dulu.");
    return null;
  }
  return data;
}

function saveTelegramConfig(data) {
  const previous = readJson(telegramPath()) || {};
  const saved = {
    ...previous,
    ...data,
    updated_at: nowUtc(),
  };
  if (!saved.created_at) saved.created_at = saved.updated_at;
  atomicWriteJson(telegramPath(), saved);
  return telegramPath();
}

// ─── Send Telegram message ───────────────────────────────────────────────────
async function sendTelegramMessage(config, text) {
  const token = String(config.bot_token || "").trim();
  const chatId = String(config.chat_id || "").trim();
  if (!token || !chatId) throw new CliError("BOT_TOKEN atau CHAT_ID Telegram belum lengkap.");
  const response = await httpRequest(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": `seotask/${CLI_VERSION}` },
    data: Buffer.from(JSON.stringify({ chat_id: chatId, text }), "utf8"),
    timeout: 12,
    retries: 1,
    ipv4Fallback: true,
    maxBodyBytes: 300000,
  });
  const body = response.body.toString("utf8");
  let data;
  try {
    data = JSON.parse(body);
  } catch (_) {
    throw new CliError(`Respons Telegram bukan JSON valid: ${body.slice(0, 220)}`);
  }
  if (!data.ok) throw new CliError(`Telegram gagal mengirim pesan: ${data.description || body.slice(0, 220)}`);
  return data;
}

async function sendTelegramPhoto(config, photoPath, caption) {
  const token = String(config.bot_token || "").trim();
  const chatId = String(config.chat_id || "").trim();
  if (!token || !chatId) throw new CliError("BOT_TOKEN atau CHAT_ID Telegram belum lengkap.");
  const photo = fs.readFileSync(photoPath);
  const ext = path.extname(photoPath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";
  const boundary = `----seotask-${crypto.randomBytes(12).toString("hex")}`;
  const chunks = [];
  const field = (name, value) => {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, "utf8"));
  };
  field("chat_id", chatId);
  field("caption", String(caption || "").slice(0, 1000));
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${path.basename(photoPath)}"\r\nContent-Type: ${contentType}\r\n\r\n`, "utf8"));
  chunks.push(photo);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"));
  const dataBuffer = Buffer.concat(chunks);
  const response = await httpRequest(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(dataBuffer.length),
      "User-Agent": `seotask/${CLI_VERSION}`,
    },
    data: dataBuffer,
    timeout: 20,
    retries: 1,
    ipv4Fallback: true,
    maxBodyBytes: 500000,
  });
  const body = response.body.toString("utf8");
  let result;
  try {
    result = JSON.parse(body);
  } catch (_) {
    throw new CliError(`Respons Telegram bukan JSON valid: ${body.slice(0, 220)}`);
  }
  if (!result.ok) throw new CliError(`Telegram gagal mengirim foto: ${result.description || body.slice(0, 220)}`);
  return result;
}

async function sendReloginTelegramNotification(status, details = {}) {
  const config = loadTelegramConfig(false);
  if (!config) return false;
  const { publicIpAddress } = require("./auth");
  const timezone = normalizeTimezone(config.timezone || "Asia/Jakarta");
  const ip = await publicIpAddress();
  const lines = [
    "SeoTask Auto Relogin",
    `Status: ${status}`,
    `Trigger: ${details.trigger || "-"}`,
    `Waktu: ${formatHumanDate(new Date(), timezone, true)}`,
    `Hostname VPS: ${os.hostname() || "-"}`,
    `IP VPS: ${ip}`,
  ];
  if (details.email) lines.push(`Email: ${details.email}`);
  if (details.message) lines.push(`Info: ${details.message}`);
  await sendTelegramMessage(config, lines.join("\n"));
  return true;
}

// ─── Earnings message builder ────────────────────────────────────────────────
function telegramLastLogText(config) {
  const last = lastRelevantLogLine();
  if (!last) return { line: "Log masih kosong", time: "-" };
  const line = last.text.length > 220 ? `${last.text.slice(0, 217)}...` : last.text;
  const time = last.date ? formatHumanDate(last.date, config.timezone || "Asia/Jakarta", true) : "-";
  return { line, time };
}

async function buildTelegramEarningsMessage(config) {
  const { publicIpAddress } = require("./auth");
  const timezone = normalizeTimezone(config.timezone);
  const dateKey = config.report_date || previousDateKeyInTimezone(timezone);
  const earnings = readJson(earningsPath()) || {};
  const day = earnings[dateKey] && typeof earnings[dateKey] === "object" ? earnings[dateKey] : {};
  const ip = await publicIpAddress();
  const hostname = os.hostname() || "-";
  const tasks = Number.parseInt(day.tasks || 0, 10) || 0;
  const rub = roundRub(Number(day.rub) || 0);
  const health = analyzeRunnerHealth();
  const lastLog = telegramLastLogText({ ...config, timezone });
  return [
    `🖥️ ${hostname}`,
    `🌐 ${ip}`,
    `⚙️ Service: ${health.serviceActive}`,
    `🏃 Runner: ${health.runner}`,
    `🩺 Health: ${health.health}`,
    `✅ ${tasks} Task`,
    `💰 ${rub} RUB`,
    `🗓️ Earnings ${formatDateKeyHuman(dateKey, timezone)}`,
    `📌 Last: ${lastLog.line}`,
    `🕒 Last log: ${lastLog.time}`,
  ].join("\n");
}

// ─── Scheduler helpers ───────────────────────────────────────────────────────
function removeTelegramCron() {
  if (!commandExists("crontab")) return false;
  const { spawnSync } = require("child_process");
  const current = spawnSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const text = current.status === 0 ? current.stdout || "" : "";
  const filtered = text.split(/\r?\n/).filter((line) => !line.includes("seotask-telegram")).join("\n").trim();
  const next = filtered ? `${filtered}\n` : "";
  const apply = spawnSync("crontab", ["-"], { input: next, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  if (apply.status !== 0) throw new CliError((apply.stderr || "").trim() || "Gagal update crontab.");
  return text !== next;
}

function installTelegramCron(config) {
  if (!commandExists("crontab")) return false;
  removeTelegramCron();
  const { spawnSync } = require("child_process");
  const current = spawnSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const text = current.status === 0 ? current.stdout || "" : "";
  const [hour, minute] = String(config.time).split(":");
  const block = [
    `CRON_TZ=${config.timezone} # seotask-telegram`,
    `${minute} ${hour} * * * ${INSTALL_PATH} telegram send >/dev/null 2>&1 # seotask-telegram`,
  ].join("\n");
  const next = `${text.trim() ? `${text.trim()}\n` : ""}${block}\n`;
  const apply = spawnSync("crontab", ["-"], { input: next, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  if (apply.status !== 0) throw new CliError((apply.stderr || "").trim() || "Gagal install cron Telegram.");
  return true;
}

function removeTelegramSystemd() {
  if (!systemdAvailable() || !require("./utils").isRoot()) return false;
  runSystemctl(["disable", "--now", TELEGRAM_TIMER_NAME]);
  for (const file of [TELEGRAM_SERVICE_PATH, TELEGRAM_TIMER_PATH]) {
    try {
      fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  runSystemctl(["daemon-reload"]);
  return true;
}

function telegramServiceUnitText() {
  return `[Unit]
Description=SeoTask Daily Telegram Earnings Report
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${INSTALL_PATH} telegram send
Environment=SEOTASK_TELEGRAM_SERVICE=1
`;
}

function telegramTimerUnitText(config) {
  return `[Unit]
Description=Run SeoTask daily Telegram earnings report

[Timer]
OnCalendar=*-*-* ${config.time}:00 ${config.timezone}
Persistent=true

[Install]
WantedBy=timers.target
`;
}

function installTelegramSystemd(config) {
  if (!systemdAvailable() || !require("./utils").isRoot()) return false;
  fs.writeFileSync(TELEGRAM_SERVICE_PATH, telegramServiceUnitText(), "utf8");
  fs.writeFileSync(TELEGRAM_TIMER_PATH, telegramTimerUnitText(config), "utf8");
  runSystemctl(["daemon-reload"]);
  const enable = runSystemctl(["enable", "--now", TELEGRAM_TIMER_NAME]);
  if (enable.status !== 0) throw new CliError((enable.stderr || "").trim() || "Gagal enable Telegram timer.");
  return true;
}

function configureTelegramSchedule(config) {
  if (!config.enabled) return "disabled";
  if (installTelegramSystemd(config)) return "systemd";
  if (installTelegramCron(config)) return "cron";
  return "manual";
}

function disableTelegramSchedule() {
  const systemdRemoved = removeTelegramSystemd();
  let cronRemoved = false;
  if (commandExists("crontab")) cronRemoved = removeTelegramCron();
  return systemdRemoved ? "systemd" : (cronRemoved ? "cron" : "manual");
}

function telegramScheduleStatus() {
  if (systemdAvailable()) {
    const active = (runSystemctl(["is-active", TELEGRAM_TIMER_NAME]).stdout || "").trim();
    if (active === "active") return "systemd timer aktif";
  }
  if (commandExists("crontab")) {
    const { spawnSync } = require("child_process");
    const current = spawnSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (current.status === 0 && String(current.stdout || "").includes("seotask-telegram")) return "cron aktif";
  }
  return "manual/tidak aktif";
}

// ─── Runner health (used by telegram earnings) ───────────────────────────────
function analyzeRunnerHealth() {
  const {
    STALE_TASK_GRACE_SECONDS,
    NO_ACTIVITY_SECONDS,
  } = require("../config/constants");
  const {
    readJson,
    statePath,
    processAlive,
    dateAgeSeconds,
    lastRelevantLogLine,
    serviceStatusValue,
  } = require("./utils");
  const state = readJson(statePath()) || {};
  const running = Boolean(state.running);
  const pid = Number.parseInt(state.pid || 0, 10) || 0;
  const pidAlive = pid > 0 ? processAlive(pid) : null;
  const staleState = Boolean(running && pid > 0 && !pidAlive);
  const updatedAge = dateAgeSeconds(state.updated_at);
  const taskLimit = (Number.parseInt(state.current_task_timer || 0, 10) || 0) + STALE_TASK_GRACE_SECONDS;
  const staleTask = Boolean(running && !staleState && state.current_task_running && updatedAge !== null && updatedAge > taskLimit);
  const lastLog = lastRelevantLogLine();
  const lastLogAge = lastLog && lastLog.date ? dateAgeSeconds(lastLog.date) : null;
  const serviceActive = require("fs").existsSync(SERVICE_PATH) ? serviceStatusValue("is-active") : "not installed";
  const serviceEnabled = require("fs").existsSync(SERVICE_PATH) ? serviceStatusValue("is-enabled") : "not installed";
  const serviceProblem = ["failed", "activating"].includes(serviceActive);
  const noActivity = Boolean(running && !staleState && !staleTask && lastLogAge !== null && lastLogAge > NO_ACTIVITY_SECONDS);
  let health = "OK";
  if (staleState) health = "STALE_STATE";
  else if (staleTask) health = "STALE_TASK";
  else if (serviceProblem) health = "SERVICE_PROBLEM";
  else if (noActivity) health = "NO_ACTIVITY";
  let runner = "not running";
  if (staleState) runner = "stale";
  else if (running && state.current_task_running) runner = "task";
  else if (running) runner = "waiting";
  else if (state.stopped_at) runner = "stopped";
  return { state, running, pid, pidAlive, staleState, staleTask, noActivity, health, runner, serviceActive, serviceEnabled, lastLog, lastLogAge, updatedAge };
}

module.exports = {
  loadTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendReloginTelegramNotification,
  telegramLastLogText,
  buildTelegramEarningsMessage,
  removeTelegramCron,
  installTelegramCron,
  removeTelegramSystemd,
  telegramServiceUnitText,
  telegramTimerUnitText,
  installTelegramSystemd,
  configureTelegramSchedule,
  disableTelegramSchedule,
  telegramScheduleStatus,
  analyzeRunnerHealth,
};