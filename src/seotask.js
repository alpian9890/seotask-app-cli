#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");
const { URL, URLSearchParams } = require("url");

const APP_NAME = "seotask-cli";
const CLI_VERSION = "1.0.3";
const GITHUB_REPO = "alpian9890/seotask-app-cli";
const BASE_URL = "https://seo-task.com";
const WEBAPP_URL = `${BASE_URL}/webphone/`;
const DEFAULT_COOKIE_DOMAIN = "seo-task.com";
const SERVICE_NAME = "seotask.service";
const SERVICE_PATH = "/etc/systemd/system/seotask.service";
const TELEGRAM_SERVICE_NAME = "seotask-telegram.service";
const TELEGRAM_TIMER_NAME = "seotask-telegram.timer";
const TELEGRAM_SERVICE_PATH = `/etc/systemd/system/${TELEGRAM_SERVICE_NAME}`;
const TELEGRAM_TIMER_PATH = `/etc/systemd/system/${TELEGRAM_TIMER_NAME}`;
const INSTALL_PATH = "/usr/local/bin/seotask";
const ANDROID_APP_PACKAGE = "com.example.videoload";
const ANDROID_APP_VERSION = "1.3.3";
const ANDROID_TOKEN_SALT = "seo_task_ge6fdgvskt";
const HTTP_RETRY_ATTEMPTS = 3;
const HTTP_RETRY_BASE_DELAY = 1200;
const MAX_LOG_LINES = 200;
const STALE_TASK_GRACE_SECONDS = 120;
const NO_ACTIVITY_SECONDS = 600;
const DEFAULT_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 " +
  "SeoTask-App/1.0";
const FINGERPRINT_PRESETS = {
  "pixel-7": {
    label: "Google Pixel 7",
    user_agent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand: "google", model: "Pixel 7", device: "panther", hardware: "google", manufacturer: "Google", product: "panther", board: "panther" },
    os: { sdk_int: 33, release: "13", incremental: "TQ3A.230901.001" },
    display: { width_px: 1080, height_px: 2400, density_dpi: 420, density: 2.625 },
    extra: { fingerprint: "google/panther/panther:13/TQ3A.230901.001/1234567:user/release-keys", tags: "release-keys", type: "user", user: "android-build", host: "abfarm" },
  },
  "pixel-8-pro": {
    label: "Google Pixel 8 Pro",
    user_agent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand: "google", model: "Pixel 8 Pro", device: "husky", hardware: "google", manufacturer: "Google", product: "husky", board: "husky" },
    os: { sdk_int: 34, release: "14", incremental: "AP1A.240505.005" },
    display: { width_px: 1344, height_px: 2992, density_dpi: 480, density: 3 },
    extra: { fingerprint: "google/husky/husky:14/AP1A.240505.005/11515064:user/release-keys", tags: "release-keys", type: "user", user: "android-build", host: "abfarm" },
  },
  "samsung-s20-ultra": {
    label: "Samsung Galaxy S20 Ultra",
    user_agent:
      "Mozilla/5.0 (Linux; Android 13; SM-G988B) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand: "samsung", model: "SM-G988B", device: "z3s", hardware: "exynos990", manufacturer: "samsung", product: "z3sxeea", board: "exynos990" },
    os: { sdk_int: 33, release: "13", incremental: "G988BXXSIHWD4" },
    display: { width_px: 1440, height_px: 3200, density_dpi: 560, density: 3.5 },
    extra: { fingerprint: "samsung/z3sxeea/z3s:13/TP1A.220624.014/G988BXXSIHWD4:user/release-keys", tags: "release-keys", type: "user", user: "dpi", host: "SWDH3011" },
  },
  "samsung-a54": {
    label: "Samsung Galaxy A54",
    user_agent:
      "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand: "samsung", model: "SM-A546B", device: "a54x", hardware: "s5e8835", manufacturer: "samsung", product: "a54xnsxx", board: "s5e8835" },
    os: { sdk_int: 34, release: "14", incremental: "A546BXXU7CXDD" },
    display: { width_px: 1080, height_px: 2340, density_dpi: 450, density: 2.8125 },
    extra: { fingerprint: "samsung/a54xnsxx/a54x:14/UP1A.231005.007/A546BXXU7CXDD:user/release-keys", tags: "release-keys", type: "user", user: "dpi", host: "SWDH3012" },
  },
  "redmi-note-14": {
    label: "Redmi Note 14",
    user_agent:
      "Mozilla/5.0 (Linux; Android 14; 24090RA29G) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand: "Redmi", model: "24090RA29G", device: "beryl", hardware: "qcom", manufacturer: "Xiaomi", product: "beryl_global", board: "beryl" },
    os: { sdk_int: 34, release: "14", incremental: "OS1.0.6.0.UNOGRXM" },
    display: { width_px: 1080, height_px: 2400, density_dpi: 440, density: 2.75 },
    extra: { fingerprint: "Redmi/beryl_global/beryl:14/UP1A.231005.007/OS1.0.6.0.UNOGRXM:user/release-keys", tags: "release-keys", type: "user", user: "builder", host: "mi-server" },
  },
  "realme-5": {
    label: "Realme 5",
    user_agent:
      "Mozilla/5.0 (Linux; Android 10; RMX1911) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand: "realme", model: "RMX1911", device: "RMX1911", hardware: "qcom", manufacturer: "realme", product: "RMX1911", board: "sdm665" },
    os: { sdk_int: 29, release: "10", incremental: "1598267357" },
    display: { width_px: 720, height_px: 1600, density_dpi: 320, density: 2 },
    extra: { fingerprint: "realme/RMX1911/RMX1911:10/QKQ1.191014.001/1598267357:user/release-keys", tags: "release-keys", type: "user", user: "root", host: "ubuntu" },
  },
};

class CliError extends Error {}

class UsageError extends CliError {}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowUtc() {
  return new Date().toISOString().replace("Z", "+00:00");
}

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowLogPrefix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `[${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}][${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`;
}

function logEvent(message) {
  const line = `${nowLogPrefix()} ${message}`;
  console.log(line);
  appendLogLine(line);
}

function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function configDir() {
  if (process.env.SEOTASK_HOME) return path.resolve(expandHome(process.env.SEOTASK_HOME));
  if (process.env.XDG_CONFIG_HOME) return path.join(path.resolve(expandHome(process.env.XDG_CONFIG_HOME)), APP_NAME);
  return path.join(os.homedir(), ".config", APP_NAME);
}

function sessionPath() {
  return path.join(configDir(), "session.json");
}

function statePath() {
  return path.join(configDir(), "state.json");
}

function logPath() {
  return path.join(configDir(), "seotask.log");
}

function earningsPath() {
  return path.join(configDir(), "earnings.json");
}

function fingerprintPath() {
  return path.join(configDir(), "fingerprint.json");
}

function telegramPath() {
  return path.join(configDir(), "telegram.json");
}

function credentialsPath() {
  return path.join(configDir(), "credentials.json");
}

function binaryPath() {
  return process.pkg ? process.execPath : path.resolve(process.argv[1] || process.execPath);
}

function detectReleaseArch() {
  if (process.arch === "x64") return "amd64";
  if (process.arch === "arm64") return "arm64";
  throw new CliError(`Arsitektur tidak didukung untuk update: ${process.arch}`);
}

function releaseArchText() {
  try {
    return detectReleaseArch();
  } catch (_) {
    return process.arch;
  }
}

function fileStatus(file) {
  try {
    const stat = fs.statSync(file);
    return stat.isDirectory() ? "directory" : `ada (${stat.size} bytes)`;
  } catch (error) {
    if (error.code === "ENOENT") return "belum ada";
    return `error: ${error.message || error}`;
  }
}

function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function ensureConfigDir() {
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(configDir(), 0o700);
  } catch (_) {}
}

function atomicWriteJson(file, data, mode = 0o600) {
  ensureConfigDir();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(sortJsonValue(data), null, 2)}\n`, { encoding: "utf8", mode });
  try {
    fs.chmodSync(tmp, mode);
  } catch (_) {}
  fs.renameSync(tmp, file);
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortJsonValue(value[key]);
    return result;
  }, {});
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new CliError(`File config rusak: ${file}: ${error.message}`);
    throw error;
  }
}

function appendLogLine(line) {
  try {
    ensureConfigDir();
    const lines = readLogLines();
    lines.push(line);
    const trimmed = lines.slice(-MAX_LOG_LINES);
    fs.writeFileSync(logPath(), `${trimmed.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (_) {}
}

function readLogLines() {
  try {
    return fs.readFileSync(logPath(), "utf8").split(/\r?\n/).filter((line) => line.length > 0);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function parseLogDate(line) {
  const match = String(line || "").match(/^\[(\d{2})-(\d{2})-(\d{4})]\[(\d{2}):(\d{2}):(\d{2})]/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date;
}

function stripLogTimestamp(line) {
  return String(line || "").replace(/^\[\d{2}-\d{2}-\d{4}]\[\d{2}:\d{2}:\d{2}]\s*/, "");
}

function lastRelevantLogLine() {
  const lines = readLogLines();
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const text = stripLogTimestamp(lines[i]);
    if (/^\[(EARNINGS|DONE|TASK|WAIT|WARN|SESSION\/ERROR|RETRY|RELOGIN|STOP|RECOVER|INFO)]/.test(text)) {
      return { raw: lines[i], text, date: parseLogDate(lines[i]) };
    }
  }
  const last = lines[lines.length - 1] || "";
  return last ? { raw: last, text: stripLogTimestamp(last), date: parseLogDate(last) } : null;
}

function dateAgeSeconds(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

function processAlive(pid) {
  const value = Number.parseInt(pid, 10);
  if (!Number.isFinite(value) || value <= 0) return false;
  try {
    process.kill(value, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function recoverStaleRunnerState(reason, logLine = true) {
  const state = readJson(statePath()) || {};
  if (!state.running) return false;
  Object.assign(state, {
    running: false,
    current_task_running: false,
    stale_state: true,
    stale_recovered_at: nowUtc(),
    stopped_at: nowUtc(),
    last_status: "RECOVER",
    last_message: reason,
    updated_at: nowUtc(),
  });
  atomicWriteJson(statePath(), state);
  if (logLine) appendLogLine(`${nowLogPrefix()} [RECOVER] ${reason}`);
  return true;
}

function analyzeRunnerHealth() {
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
  const serviceActive = serviceUnitExists() ? serviceActiveStatus() : "not installed";
  const serviceEnabled = serviceUnitExists() ? serviceEnabledStatus() : "not installed";
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

function currentCountdownText(state) {
  if (!state.running || !state.current_task_running || !state.current_task_started_at || !state.current_task_timer) {
    return null;
  }
  const started = new Date(state.current_task_started_at).getTime();
  if (Number.isNaN(started)) return null;
  const timer = Math.max(0, Number.parseInt(state.current_task_timer, 10) || 0);
  const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const remaining = Math.max(0, timer - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return `Countdown: ${mm}:${ss} | id_status=${state.current_task_id_status || "-"} | video=${state.current_task_video_id || "-"}`;
}

function formatStateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseRub(value) {
  const normalized = String(value ?? "0").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundRub(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function recordEarning(reward, taskInfo = {}) {
  const rub = roundRub(parseRub(reward));
  if (rub <= 0) return;
  const dateKey = localDateKey();
  const data = readJson(earningsPath()) || {};
  const day = data[dateKey] && typeof data[dateKey] === "object" ? data[dateKey] : {};
  day.rub = roundRub((Number(day.rub) || 0) + rub);
  day.tasks = (Number.parseInt(day.tasks || 0, 10) || 0) + 1;
  day.updated_at = nowUtc();
  if (!day.created_at) day.created_at = nowUtc();
  data[dateKey] = day;
  atomicWriteJson(earningsPath(), data);
  appendLogLine(`${nowLogPrefix()} [EARNINGS] date=${dateKey} | tasks=${day.tasks} | total=${day.rub} RUB | last_reward=${rub} RUB | id_status=${taskInfo.idStatus || "-"}`);
}

function recentEarningDays() {
  const data = readJson(earningsPath()) || {};
  return Object.entries(data)
    .filter(([, value]) => value && typeof value === "object")
    .map(([date, value]) => ({
      date,
      rub: roundRub(Number(value.rub) || 0),
      tasks: Number.parseInt(value.tasks || 0, 10) || 0,
    }))
    .filter((item) => item.rub > 0 || item.tasks > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function earningStats(days) {
  const recent = recentEarningDays().slice(-Math.max(7, days));
  const rubValues = recent.map((item) => item.rub);
  const taskValues = recent.map((item) => item.tasks);
  const totalRub = rubValues.reduce((sum, value) => sum + value, 0);
  const totalTasks = taskValues.reduce((sum, value) => sum + value, 0);
  const avgDailyRub = rubValues.length ? totalRub / rubValues.length : 0;
  const avgDailyTasks = taskValues.length ? totalTasks / taskValues.length : 0;
  const variance = rubValues.length
    ? rubValues.reduce((sum, value) => sum + Math.pow(value - avgDailyRub, 2), 0) / rubValues.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const coefficient = avgDailyRub > 0 ? stdDev / avgDailyRub : 0;
  let stability = "data belum cukup";
  if (rubValues.length >= 7) {
    if (coefficient <= 0.2) stability = "stabil";
    else if (coefficient <= 0.45) stability = "cukup stabil";
    else stability = "fluktuatif";
  }
  return {
    recent,
    dataDays: rubValues.length,
    totalRub: roundRub(totalRub),
    totalTasks,
    avgDailyRub: roundRub(avgDailyRub),
    avgDailyTasks: Math.round(avgDailyTasks),
    coefficient,
    stability,
  };
}

function sumEarnings(days = null) {
  const entries = recentEarningDays();
  const selected = days ? entries.slice(-days) : entries;
  const rub = selected.reduce((sum, item) => sum + item.rub, 0);
  const tasks = selected.reduce((sum, item) => sum + item.tasks, 0);
  return {
    rub: roundRub(rub),
    tasks,
    days: selected.length,
  };
}

function todayEarnings() {
  const date = localDateKey();
  const item = recentEarningDays().find((entry) => entry.date === date);
  return item || { date, rub: 0, tasks: 0 };
}

function averagePerTask(summary) {
  if (!summary.tasks) return 0;
  return roundRub(summary.rub / summary.tasks);
}

function taskStatusLine() {
  const health = analyzeRunnerHealth();
  const state = health.state;
  if (health.staleState) {
    return `Task: Stale state | PID ${health.pid || "-"} sudah mati | last=${state.last_status || "-"}`;
  }
  if (health.staleTask) {
    return `Task: Stale task | id_status=${state.current_task_id_status || "-"} | video=${state.current_task_video_id || "-"} | updated ${health.updatedAge}s lalu`;
  }
  if (state.running) {
    const since = formatStateTime(state.started_at);
    if (state.current_task_running) {
      return `Task: Running since ${since} | id_status=${state.current_task_id_status || "-"} | video=${state.current_task_video_id || "-"} | duration=${state.current_task_timer || 0}s`;
    }
    return `Task: Waiting since ${formatStateTime(state.last_wait_at || state.updated_at || state.started_at)} | ${state.last_message || "menunggu task"}`;
  }
  if (state.stopped_at) return `Task: Stopped since ${formatStateTime(state.stopped_at)}`;
  return "Task: Not running";
}

function saveCredentials(email, password) {
  email = String(email || "").trim();
  password = String(password || "").trim();
  if (!email) throw new CliError("Email kosong.");
  if (!password) throw new CliError("Password kosong.");
  const previous = readJson(credentialsPath()) || {};
  const data = {
    email,
    password,
    updated_at: nowUtc(),
  };
  data.created_at = previous.created_at || data.updated_at;
  atomicWriteJson(credentialsPath(), data);
  return credentialsPath();
}

function loadCredentials(required = false) {
  const data = readJson(credentialsPath());
  if (!data) {
    if (required) throw new CliError("Credentials belum diset. Jalankan `seotask creds` dulu.");
    return null;
  }
  const email = String(data.email || "").trim();
  const password = String(data.password || "").trim();
  if (!email || !password) {
    if (required) throw new CliError("Credentials tidak lengkap. Jalankan `seotask creds` ulang.");
    return null;
  }
  return { email, password };
}

function normalizeCookie(cookie) {
  cookie = String(cookie || "").trim();
  if (cookie.toLowerCase().startsWith("cookie:")) cookie = cookie.split(/:(.*)/s)[1].trim();
  cookie = cookie.replace(/[\r\n]+/g, " ").trim();
  if (!cookie) throw new CliError("Cookie kosong.");
  if (!cookie.includes("=")) throw new CliError("Format cookie tidak valid. Contoh: PHPSESSID=...; other=value");
  return cookie;
}

function domainMatches(cookieDomain, targetDomain) {
  cookieDomain = String(cookieDomain || "").trim().toLowerCase();
  targetDomain = String(targetDomain || "").trim().toLowerCase().replace(/^\./, "");
  if (cookieDomain.startsWith("#httponly_")) cookieDomain = cookieDomain.slice("#httponly_".length);
  cookieDomain = cookieDomain.replace(/^\./, "");
  return cookieDomain === targetDomain || cookieDomain.endsWith(`.${targetDomain}`);
}

function parseNetscapeCookies(text, targetDomain = DEFAULT_COOKIE_DOMAIN) {
  const pairs = [];
  const seen = new Set();
  const now = Math.floor(Date.now() / 1000);
  String(text || "")
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || (line.startsWith("#") && !line.toLowerCase().startsWith("#httponly_"))) return;
      let fields = line.split("\t");
      if (fields.length < 7) fields = line.split(/\s+/, 7);
      if (fields.length < 7) throw new CliError(`Format Netscape cookie tidak valid di baris ${index + 1}.`);
      const [domain, , , , expires, name, value] = fields;
      if (!domainMatches(domain, targetDomain)) return;
      const key = String(name || "").trim();
      if (!key || seen.has(key)) return;
      const expiresInt = Number.parseInt(expires || "0", 10) || 0;
      if (expiresInt && expiresInt < now) return;
      seen.add(key);
      pairs.push(`${key}=${String(value || "").trim()}`);
    });
  if (!pairs.length) throw new CliError(`Tidak ada cookie aktif untuk domain ${targetDomain} di Netscape cookie input.`);
  return pairs.join("; ");
}

function looksLikeNetscapeCookie(text) {
  const value = String(text || "");
  if (value.slice(0, 500).toLowerCase().includes("# netscape http cookie file")) return true;
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    return line.split("\t").length >= 7;
  }
  return false;
}

function parseCookieInput(text, targetDomain = DEFAULT_COOKIE_DOMAIN) {
  text = String(text || "").trim();
  if (!text) throw new CliError("Cookie kosong.");
  if (looksLikeNetscapeCookie(text)) return parseNetscapeCookies(text, targetDomain);
  return normalizeCookie(text);
}

function readCookieFile(file, targetDomain = DEFAULT_COOKIE_DOMAIN) {
  return parseCookieInput(fs.readFileSync(path.resolve(expandHome(file)), "utf8"), targetDomain);
}

function parseCookieHeader(cookieHeader) {
  const parsed = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const item = part.trim();
    if (!item || !item.includes("=")) continue;
    const eq = item.indexOf("=");
    const key = item.slice(0, eq).trim();
    if (!key) continue;
    parsed[key] = item.slice(eq + 1).trim();
  }
  return parsed;
}

function cookieDictToHeader(cookies) {
  return Object.entries(cookies || {})
    .filter(([key]) => key)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function parseSetCookie(line) {
  const first = String(line || "").split(";")[0];
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const attrs = {};
  for (const attr of String(line || "").split(";").slice(1)) {
    const [name, ...rest] = attr.trim().split("=");
    attrs[name.toLowerCase()] = rest.join("=");
  }
  return {
    name: first.slice(0, eq).trim(),
    value: first.slice(eq + 1).trim(),
    domain: attrs.domain || "",
  };
}

function updateCookieStoreFromSetCookie(cookieStore, setCookieLines, targetDomain = DEFAULT_COOKIE_DOMAIN) {
  for (const line of setCookieLines || []) {
    const parsed = parseSetCookie(line);
    if (!parsed || !parsed.name) continue;
    if (parsed.domain && !domainMatches(parsed.domain, targetDomain)) continue;
    if (!parsed.value) delete cookieStore[parsed.name];
    else cookieStore[parsed.name] = parsed.value;
  }
}

function normalizeUserAgent(userAgent) {
  let candidate = String(userAgent || "").trim();
  if (!candidate) candidate = DEFAULT_UA;
  candidate = candidate.replace(/[\r\n]+/g, " ").trim();
  if (!candidate) throw new CliError("User-Agent kosong.");
  return candidate;
}

function normalizeHeaderValue(name, value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/[\r\n]+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.includes(":") && String(name).toLowerCase().startsWith("x-")) {
    throw new CliError(`Nilai header ${name} tidak valid.`);
  }
  return normalized;
}

function generateDeviceId() {
  return `pro_${crypto.randomBytes(32).toString("hex").slice(0, 16)}`;
}

function buildAppToken(deviceId, appPackage) {
  return crypto.createHash("sha256").update(`${deviceId}:${appPackage}:${ANDROID_TOKEN_SALT}`, "utf8").digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function fingerprintPresetNames() {
  return Object.keys(FINGERPRINT_PRESETS).sort();
}

function normalizePresetName(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const aliases = {
    "samsung-20-ultra": "samsung-s20-ultra",
    "s20-ultra": "samsung-s20-ultra",
    "galaxy-s20-ultra": "samsung-s20-ultra",
    "galaxy-a54": "samsung-a54",
    "redmi-note14": "redmi-note-14",
    "redmi-14": "redmi-note-14",
    "pixel8pro": "pixel-8-pro",
    "pixel-8": "pixel-8-pro",
    "realme5": "realme-5",
  };
  return aliases[raw] || raw;
}

function randomPresetName() {
  const names = fingerprintPresetNames();
  return names[crypto.randomInt(0, names.length)];
}

function titleFromSlug(slug) {
  return String(slug || "android-device")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ensureSeoTaskUserAgent(userAgent) {
  const value = normalizeUserAgent(userAgent);
  return value.includes("SeoTask-App/1.0") ? value : `${value} SeoTask-App/1.0`;
}

function customDevicePreset(deviceName) {
  const slug = normalizePresetName(deviceName) || "android-device";
  const label = titleFromSlug(slug);
  const model = label.replace(/\s+/g, " ").trim();
  const device = slug.replace(/[^a-z0-9]/g, "").slice(0, 24) || "android";
  const brand = slug.split("-")[0] || "android";
  const build = `TP1A.${crypto.randomInt(220000, 250000)}.${String(crypto.randomInt(1, 999)).padStart(3, "0")}`;
  return {
    label,
    user_agent:
      `Mozilla/5.0 (Linux; Android 13; ${model}) AppleWebKit/537.36 ` +
      "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 SeoTask-App/1.0",
    hardware: { brand, model, device, hardware: "qcom", manufacturer: brand, product: device, board: device },
    os: { sdk_int: 33, release: "13", incremental: build },
    display: { width_px: 1080, height_px: 2400, density_dpi: 420, density: 2.625 },
    extra: { fingerprint: `${brand}/${device}/${device}:13/${build}/${crypto.randomInt(1000000, 9999999)}:user/release-keys`, tags: "release-keys", type: "user", user: "android-build", host: "build-host" },
  };
}

function buildFingerprint(options = {}) {
  let presetName = normalizePresetName(options.preset || "");
  let preset;
  if (presetName) {
    preset = FINGERPRINT_PRESETS[presetName];
    if (!preset && !options.allowCustom) throw new UsageError(`preset fingerprint tidak dikenal: ${options.preset}`);
  }
  if (!preset && options.device) {
    const devicePresetName = normalizePresetName(options.device);
    presetName = FINGERPRINT_PRESETS[devicePresetName] ? devicePresetName : `custom-${devicePresetName || "android-device"}`;
    preset = FINGERPRINT_PRESETS[devicePresetName] || customDevicePreset(options.device);
  }
  if (!preset) {
    presetName = randomPresetName();
    preset = FINGERPRINT_PRESETS[presetName];
  }

  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "id-ID";
  const parts = locale.split(/[-_]/);
  const deviceId = generateDeviceId();
  const appPackage = ANDROID_APP_PACKAGE;
  const appVersion = ANDROID_APP_VERSION;
  const data = cloneJson(preset);
  return {
    version: 1,
    preset: presetName,
    label: data.label,
    created_at: nowUtc(),
    updated_at: nowUtc(),
    user_agent: ensureSeoTaskUserAgent(data.user_agent),
    x_requested_with: null,
    app_package: appPackage,
    app_version: appVersion,
    device_id: deviceId,
    app_token: buildAppToken(deviceId, appPackage),
    hardware: data.hardware,
    os: data.os,
    display: data.display,
    locale: { language: parts[0] || "id", country: parts[1] || "ID", variant: "" },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    extra: data.extra,
  };
}

function saveFingerprint(fingerprint) {
  const data = cloneJson(fingerprint);
  data.updated_at = nowUtc();
  atomicWriteJson(fingerprintPath(), data);
  return fingerprintPath();
}

function loadFingerprint(required = false) {
  const data = readJson(fingerprintPath());
  if (!data) {
    if (required) throw new CliError("Fingerprint belum dibuat. Jalankan `seotask fingerprint init` dulu.");
    return null;
  }
  let updated = false;
  if (!data.app_package) {
    data.app_package = ANDROID_APP_PACKAGE;
    updated = true;
  }
  if (!data.app_version) {
    data.app_version = ANDROID_APP_VERSION;
    updated = true;
  }
  if (!Object.prototype.hasOwnProperty.call(data, "x_requested_with")) {
    data.x_requested_with = null;
    updated = true;
  }
  if (!data.device_id) {
    data.device_id = generateDeviceId();
    updated = true;
  }
  if (!data.app_token) {
    data.app_token = buildAppToken(data.device_id, data.app_package);
    updated = true;
  }
  if (!data.user_agent) {
    data.user_agent = DEFAULT_UA;
    updated = true;
  }
  data.user_agent = ensureSeoTaskUserAgent(data.user_agent);
  if (updated) saveFingerprint(data);
  return data;
}

function printFingerprint(fingerprint) {
  console.log(`Preset: ${fingerprint.preset || "-"}`);
  console.log(`Device: ${fingerprint.label || (fingerprint.hardware && fingerprint.hardware.model) || "-"}`);
  console.log(`Android: ${(fingerprint.os && fingerprint.os.release) || "-"} (sdk ${(fingerprint.os && fingerprint.os.sdk_int) || "-"})`);
  console.log(`Device ID: ${fingerprint.device_id || "-"}`);
  console.log(`App Package: ${fingerprint.app_package || ANDROID_APP_PACKAGE}`);
  console.log(`App Version: ${fingerprint.app_version || ANDROID_APP_VERSION}`);
  console.log(`User-Agent: ${fingerprint.user_agent || "-"}`);
  if (fingerprint.display) {
    console.log(`Resolution: ${fingerprint.display.width_px}x${fingerprint.display.height_px} / dpi ${fingerprint.display.density_dpi}`);
  }
  if (fingerprint.locale) {
    console.log(`Locale: ${fingerprint.locale.language || "id"}-${fingerprint.locale.country || "ID"}`);
  }
  console.log(`Timezone: ${fingerprint.timezone || "-"}`);
  if (fingerprint.extra && fingerprint.extra.fingerprint) console.log(`Build Fingerprint: ${fingerprint.extra.fingerprint}`);
}

async function confirmFingerprint(fingerprint, canRegenerate = true) {
  if (!process.stdin.isTTY && !fs.existsSync("/dev/tty")) return "yes";
  printFingerprint(fingerprint);
  console.log("");
  const suffix = canRegenerate ? "[Y/n/r]" : "[Y/n]";
  const answer = String(await prompt(`Gunakan fingerprint ini? ${suffix} `)).trim().toLowerCase();
  if (!answer || answer === "y" || answer === "yes") return "yes";
  if (canRegenerate && (answer === "r" || answer === "regen" || answer === "random")) return "regenerate";
  return "no";
}

function alternateDeviceId(deviceId) {
  const value = String(deviceId || "").trim();
  if (value.startsWith("pro_") && value.length > 4) return `secure_${value.slice(4)}`;
  if (value.startsWith("secure_") && value.length > 7) return `pro_${value.slice(7)}`;
  return null;
}

function isRetryableHttpStatus(statusCode) {
  return [429, 500, 502, 503, 504].includes(Number(statusCode));
}

function isRetryableNetworkError(error) {
  const text = String((error && (error.code || error.message)) || error || "").toLowerCase();
  return [
    "timed out",
    "timeout",
    "connection reset",
    "connection aborted",
    "temporarily unavailable",
    "temporary failure",
    "unexpected eof",
    "eof occurred in violation of protocol",
    "tlsv1 alert internal error",
    "econnreset",
    "etimedout",
  ].some((marker) => text.includes(marker));
}

function isTransientRunnerError(message) {
  const text = String(message || "").toLowerCase();
  return [
    "gagal konek ke",
    "timed out",
    "timeout",
    "unexpected_eof_while_reading",
    "eof occurred in violation of protocol",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "bukan json valid",
  ].some((marker) => text.includes(marker));
}

function sanitizeUrlForError(url) {
  return String(url || "").replace(/\/bot[0-9]+:[^/]+/g, "/bot<REDACTED>");
}

function httpRequestOnce(url, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "http:" ? http : https;
    const body = options.data || null;
    const req = lib.request(
      parsed,
      {
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: (options.timeout || 20) * 1000,
        family: options.family,
      },
      (res) => {
        const chunks = [];
        let total = 0;
        const max = options.maxBodyBytes || 1500000;
        res.on("data", (chunk) => {
          total += chunk.length;
          if (total <= max) chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            finalUrl: url,
            body: Buffer.concat(chunks),
            headers: res.headers,
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function httpRequest(url, options = {}) {
  const attempts = Math.max(1, Number.parseInt(options.retries || HTTP_RETRY_ATTEMPTS, 10));
  let currentUrl = url;
  let headers = { ...(options.headers || {}) };
  const safeUrl = sanitizeUrlForError(url);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      let redirects = 0;
      while (true) {
        const response = await httpRequestOnce(currentUrl, { ...options, headers });
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(response.status) && location && redirects < 5) {
          redirects += 1;
          currentUrl = new URL(location, currentUrl).toString();
          if (response.headers["set-cookie"]) {
            const jar = parseCookieHeader(headers.Cookie || headers.cookie || "");
            updateCookieStoreFromSetCookie(jar, response.headers["set-cookie"]);
            const cookie = cookieDictToHeader(jar);
            if (cookie) headers.Cookie = cookie;
          }
          continue;
        }
        if (attempt < attempts && isRetryableHttpStatus(response.status)) {
          await sleep(HTTP_RETRY_BASE_DELAY * attempt);
          break;
        }
        response.finalUrl = currentUrl;
        return response;
      }
    } catch (error) {
      if (attempt < attempts && isRetryableNetworkError(error)) {
        await sleep(HTTP_RETRY_BASE_DELAY * attempt);
        continue;
      }
      if (options.ipv4Fallback && !options.family && isRetryableNetworkError(error)) {
        return httpRequest(url, { ...options, family: 4, ipv4Fallback: false });
      }
      throw new CliError(`Gagal konek ke ${safeUrl}: ${error.message || error}`);
    }
  }
  if (options.ipv4Fallback && !options.family) {
    return httpRequest(url, { ...options, family: 4, ipv4Fallback: false });
  }
  throw new CliError(`Gagal konek ke ${safeUrl}: retry habis.`);
}

function downloadFile(url, outputPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.request(
      parsed,
      {
        method: "GET",
        headers: {
          "User-Agent": `seotask/${CLI_VERSION}`,
          Accept: "application/octet-stream",
        },
        timeout: 120000,
      },
      (res) => {
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && location && redirects < 5) {
          res.resume();
          downloadFile(new URL(location, url).toString(), outputPath, redirects + 1).then(resolve, reject);
          return;
        }
        if ((res.statusCode || 0) >= 400) {
          res.resume();
          reject(new CliError(`Download gagal (HTTP ${res.statusCode || 0}).`));
          return;
        }
        const file = fs.createWriteStream(outputPath, { mode: 0o755 });
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", (error) => reject(new CliError(`Download gagal: ${error.message || error}`)));
    req.end();
  });
}

function getSetCookieArray(headers) {
  const raw = headers && headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function makeRequest(url, options = {}) {
  const ua = normalizeUserAgent(options.userAgent);
  const headers = {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: `${BASE_URL}/`,
    Connection: "keep-alive",
  };
  if (options.xRequestedWith) headers["X-Requested-With"] = options.xRequestedWith;
  if (options.appToken) headers["X-App-Token"] = options.appToken;
  if (options.appVersion) headers["X-App-Version"] = options.appVersion;
  if (options.deviceId) headers["X-Device-Id"] = options.deviceId;
  let cookie = options.cookie || null;
  if (options.cookieStore && !cookie) cookie = cookieDictToHeader(options.cookieStore);
  if (cookie) headers.Cookie = cookie;
  const response = await httpRequest(url, {
    method: "GET",
    headers,
    timeout: options.timeout || 20,
    maxBodyBytes: 1500000,
  });
  if (options.cookieStore) {
    updateCookieStoreFromSetCookie(options.cookieStore, getSetCookieArray(response.headers), options.cookieDomain || DEFAULT_COOKIE_DOMAIN);
  }
  return [response.status, response.finalUrl, response.body.toString("utf8")];
}

function htmlUnescape(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function pageTitle(body) {
  const match = String(body || "").match(/<title[^>]*>(.*?)<\/title>/is);
  if (!match) return "(tanpa title)";
  return htmlUnescape(match[1].replace(/\s+/g, " ").trim()) || "(tanpa title)";
}

function looksLoggedIn(finalUrl, body) {
  const lowerUrl = String(finalUrl || "").toLowerCase();
  const lowerBody = String(body || "").toLowerCase();
  const loginMarkers = ["type=\"password\"", "name=\"password\"", "login", "\u0432\u043e\u0439\u0442\u0438", "\u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f"];
  const taskMarkers = ["logout", "\u0432\u044b\u0445\u043e\u0434", "\u0437\u0430\u0434\u0430\u043d\u0438", "video", "youtube", "webphone"];
  if (lowerUrl.includes("login") || lowerUrl.includes("auth")) return [false, "URL akhir terlihat seperti halaman login/auth."];
  if (taskMarkers.some((m) => lowerBody.includes(m)) && !loginMarkers.slice(0, 3).some((m) => lowerBody.includes(m))) {
    return [true, "Halaman berisi marker dashboard/task."];
  }
  if (loginMarkers.some((m) => lowerBody.includes(m))) return [false, "Halaman berisi form/marker login."];
  return [false, "Tidak bisa memastikan session login dari HTML."];
}

function stripHtmlText(body) {
  let text = String(body || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, " ");
  text = text.replace(/<[^>]+>/g, " ");
  return htmlUnescape(text.replace(/\s+/g, " ")).trim();
}

function extractAccountInfo(body) {
  const info = {};
  for (const pattern of [/Привет\s*([^<\n\r]{1,60})</i, /Hello\s*([^<\n\r]{1,60})</i]) {
    const match = String(body || "").match(pattern);
    if (!match) continue;
    const name = htmlUnescape(match[1]).replace(/\s+/g, " ").replace(/^[ \-:\t\r\n]+|[ \-:\t\r\n]+$/g, "");
    if (name) {
      info.account_name = name;
      break;
    }
  }
  const text = stripHtmlText(body);
  const patterns = [
    /id=["']balanceUp["'][^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:\u20bd|RUB)?/i,
    /Баланс[^0-9]{0,40}([0-9]+(?:[.,][0-9]+)?)\s*(?:\u20bd|RUB)/i,
    /Заработок[^0-9]{0,40}([0-9]+(?:[.,][0-9]+)?)\s*(?:\u20bd|RUB)/i,
  ];
  for (const pattern of patterns) {
    const match = String(body || "").match(pattern) || text.match(pattern);
    if (!match) continue;
    info.balance_rub = match[1].replace(",", ".").trim();
    break;
  }
  return info;
}

function extractLoginHash(body) {
  const patterns = [
    /name=["']hash["'][^>]*value=["']([A-Za-z0-9_-]{8,128})["']/i,
    /hash_ajax\s*[:=]\s*['"]([A-Za-z0-9_-]{8,128})['"]/i,
    /startVideoWatching\(\s*['"]([A-Za-z0-9_-]{8,128})['"]\s*\)/i,
  ];
  for (const pattern of patterns) {
    const match = String(body || "").match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getHtmlAttribute(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag || "").match(new RegExp(`${escaped}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? htmlUnescape(match[2]) : "";
}

function extractLoginCaptcha(body) {
  const html = String(body || "");
  const questionMatch = html.match(/<div\b[^>]*class=["'][^"']*\bout-capcha-vopros\b[^"']*["'][^>]*>(.*?)<\/div>/is);
  const question = questionMatch ? stripHtmlText(questionMatch[1]) : "";
  const options = [];
  const seen = new Set();
  const inputRegex = /<input\b[^>]*name=["']capcha\[\]["'][^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(html))) {
    const value = getHtmlAttribute(match[0], "value");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ number: options.length + 1, value });
  }
  const images = [];
  const imageRegex = /background-image\s*:\s*url\(\s*data:image\/([a-z0-9.+-]+);base64,([^)]*)\)/gi;
  while ((match = imageRegex.exec(html))) {
    const mime = match[1].toLowerCase();
    const base64 = String(match[2] || "").replace(/\s+/g, "");
    if (!base64) continue;
    let buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch (_) {
      continue;
    }
    if (!buffer.length) continue;
    images.push({
      mime,
      ext: mime === "jpeg" || mime === "jpg" ? "jpg" : mime === "png" ? "png" : "img",
      base64,
      buffer,
    });
  }
  if (!question && !options.length && !images.length) return null;
  return { question, options, images };
}

function saveCaptchaAssets(captcha) {
  const dir = path.join(configDir(), "captcha");
  ensureConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = `${Date.now()}-${process.pid}`;
  const savedImages = captcha.images.map((image, index) => {
    const role = index === 0 ? "target" : `options-${index}`;
    const file = path.join(dir, `login-${stamp}-${role}.${image.ext}`);
    fs.writeFileSync(file, image.buffer, { mode: 0o600 });
    return { ...image, file };
  });
  const optionsImage = savedImages.slice().sort((a, b) => b.buffer.length - a.buffer.length)[0] || null;
  const targetImage = savedImages.find((image) => image !== optionsImage) || null;
  let htmlPath = null;
  if (optionsImage) {
    htmlPath = path.join(dir, `login-${stamp}-preview.html`);
    const cells = captcha.options.map((option, index) => {
      const left = (index % 4) * 25;
      const top = Math.floor(index / 4) * 50;
      return `<div class="cell" style="left:${left}%;top:${top}%">${option.number}</div>`;
    }).join("\n");
    const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>SeoTask Login CAPTCHA</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;background:#f6f6f6;color:#111}
.wrap{display:inline-block;position:relative;background:#fff;border:1px solid #bbb}
.wrap img{display:block;max-width:100%;height:auto}
.cell{position:absolute;width:25%;height:50%;box-sizing:border-box;border:2px solid rgba(255,255,255,.9);background:rgba(0,0,0,.18);color:#fff;font:bold 22px Arial,sans-serif;text-shadow:0 1px 2px #000;padding:5px}
.target{margin:0 0 12px}
</style>
</head>
<body>
<h3>CAPTCHA: ${htmlEscape(captcha.question || "(tanpa pertanyaan)")}</h3>
${targetImage ? `<div class="target">Gambar referensi:<br><img src="data:image/${targetImage.mime};base64,${targetImage.base64}" alt="target"></div>` : ""}
<div>Gambar pilihan bernomor:</div>
<div class="wrap"><img src="data:image/${optionsImage.mime};base64,${optionsImage.base64}" alt="options">${cells}</div>
</body>
</html>
`;
    fs.writeFileSync(htmlPath, html, { encoding: "utf8", mode: 0o600 });
  }
  return {
    targetPath: targetImage ? targetImage.file : null,
    optionsPath: optionsImage ? optionsImage.file : null,
    htmlPath,
  };
}

function htmlEscape(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayCaptchaImageIfPossible(file) {
  if (!file || !process.stdout.isTTY) return;
  const candidates = [
    { cmd: "chafa", args: ["--size=80x24", file] },
    { cmd: "viu", args: ["-w", "80", file] },
    { cmd: "img2txt", args: ["-W", "80", file] },
  ];
  for (const candidate of candidates) {
    const found = spawnSync("sh", ["-c", `command -v ${candidate.cmd}`], { encoding: "utf8" });
    if (found.status !== 0) continue;
    spawnSync(candidate.cmd, candidate.args, { stdio: "inherit" });
    return;
  }
}

async function promptCaptchaSelection(captcha) {
  if (!captcha || !captcha.options.length) return [];
  const assets = saveCaptchaAssets(captcha);
  console.log(`CAPTCHA: ${captcha.question || "(pertanyaan tidak ditemukan)"}`);
  if (assets.targetPath) console.log(`Gambar referensi: ${assets.targetPath}`);
  if (assets.optionsPath) console.log(`Gambar pilihan: ${assets.optionsPath}`);
  if (assets.htmlPath) console.log(`Preview bernomor: ${assets.htmlPath}`);
  console.log("Nomor pilihan: 1-8 dari kiri ke kanan, atas ke bawah.");
  await sendCaptchaPreviewToTelegram(captcha, assets);
  displayCaptchaImageIfPossible(assets.optionsPath);
  while (true) {
    const answer = String(await prompt("Pilih nomor captcha (contoh: 1 4 8): ")).trim();
    const numbers = answer.split(/[,\s]+/).filter(Boolean).map((value) => Number(value));
    const invalid = !numbers.length || numbers.some((value) => !Number.isInteger(value) || value < 1 || value > captcha.options.length);
    if (invalid) {
      console.log(`Input tidak valid. Masukkan nomor 1-${captcha.options.length}, pisahkan dengan spasi atau koma.`);
      continue;
    }
    return [...new Set(numbers)].map((number) => captcha.options[number - 1].value);
  }
}

async function sendCaptchaPreviewToTelegram(captcha, assets, options = {}) {
  const config = loadTelegramConfig(false);
  if (!config) {
    console.log("Preview CAPTCHA belum dikirim ke Telegram. Jalankan `seotask telegram setup` untuk mengaktifkan pengiriman preview CAPTCHA.");
    return false;
  }
  if (!assets.optionsPath) {
    console.log("Preview CAPTCHA tidak dikirim ke Telegram: gambar pilihan tidak ditemukan.");
    return false;
  }
  try {
    const timezone = normalizeTimezone(config.timezone || "Asia/Jakarta");
    const ip = await publicIpAddress();
    const caption = [
      options.sessionExpired ? "SeoTask Session Expired" : "SeoTask CAPTCHA Login",
      options.sessionExpired ? "Sesi login habis. Credentials tersedia, tetapi service tidak punya terminal untuk input CAPTCHA." : null,
      `CAPTCHA: ${captcha.question || "-"}`,
      `Waktu: ${formatHumanDate(new Date(), timezone, true)}`,
      `Hostname VPS: ${os.hostname() || "-"}`,
      `IP VPS: ${ip}`,
      "Pilih nomor dari kiri ke kanan, atas ke bawah.",
    ].filter(Boolean).join("\n");
    await sendTelegramPhoto(config, assets.optionsPath, caption);
    console.log(options.sessionExpired ? "Preview CAPTCHA relogin sudah dikirim ke bot Telegram." : "Preview CAPTCHA sudah dikirim ke bot Telegram.");
    return true;
  } catch (error) {
    console.log(`Preview CAPTCHA gagal dikirim ke Telegram: ${error.message || error}`);
    console.log(options.sessionExpired ? "Preview CAPTCHA relogin tetap tersimpan di file lokal di atas." : "Login tetap bisa dilanjutkan memakai file gambar lokal di atas.");
    return false;
  }
}

function extractErrorMessage(scriptBody) {
  const match = String(scriptBody || "").match(/error_load\\\('((?:\\'|[^'])*)'\\\)/);
  if (!match) return null;
  return match[1].replace(/\\'/g, "'").trim() || null;
}

function loadSession(required = true) {
  const session = readJson(sessionPath());
  if (required && !session) {
    throw new CliError("Belum login. Jalankan `seotask login --email ... --password ...` atau import cookie dengan `seotask login --cookie ...`.");
  }
  if (session) {
    const fingerprint = loadFingerprint(false) || {};
    let updated = false;
    if (!session.user_agent || String(session.user_agent).includes("SeoTask-CLI/0.1")) {
      session.user_agent = fingerprint.user_agent || DEFAULT_UA;
      updated = true;
    }
    if (!Object.prototype.hasOwnProperty.call(session, "x_requested_with")) {
      session.x_requested_with = Object.prototype.hasOwnProperty.call(fingerprint, "x_requested_with") ? fingerprint.x_requested_with : null;
      updated = true;
    }
    if (!session.app_package) {
      session.app_package = fingerprint.app_package || ANDROID_APP_PACKAGE;
      updated = true;
    }
    if (!session.app_version) {
      session.app_version = fingerprint.app_version || ANDROID_APP_VERSION;
      updated = true;
    }
    if (!session.device_id) {
      session.device_id = fingerprint.device_id || generateDeviceId();
      updated = true;
    }
    if (!session.app_token) {
      session.app_token = fingerprint.app_token || buildAppToken(session.device_id, session.app_package);
      updated = true;
    }
    if (updated) {
      session.updated_at = nowUtc();
      atomicWriteJson(sessionPath(), session);
    }
  }
  return session;
}

function saveSessionCookie(cookie, options = {}) {
  cookie = parseCookieInput(cookie, options.targetDomain || DEFAULT_COOKIE_DOMAIN);
  const appPackage = normalizeHeaderValue("App-Package", options.appPackage) || ANDROID_APP_PACKAGE;
  const appVersion = normalizeHeaderValue("X-App-Version", options.appVersion) || ANDROID_APP_VERSION;
  const deviceId = normalizeHeaderValue("X-Device-Id", options.deviceId) || generateDeviceId();
  const appToken = normalizeHeaderValue("X-App-Token", options.appToken) || buildAppToken(deviceId, appPackage);
  const previous = readJson(sessionPath()) || {};
  const data = {
    base_url: BASE_URL,
    cookie,
    created_at: previous.created_at || nowUtc(),
    updated_at: nowUtc(),
    user_agent: normalizeUserAgent(options.userAgent),
    x_requested_with: normalizeHeaderValue("X-Requested-With", options.xRequestedWith),
    app_package: appPackage,
    app_version: appVersion,
    device_id: deviceId,
    app_token: appToken,
  };
  if (previous.login_email) data.login_email = previous.login_email;
  atomicWriteJson(sessionPath(), data);
  return sessionPath();
}

async function runLoginWithCredentials(args, email, password, quiet = false) {
  const session = loadSession(false) || {};
  const fingerprint = loadFingerprint(false) || {};
  const targetDomain = args.domain || DEFAULT_COOKIE_DOMAIN;
  const userAgent = normalizeUserAgent(args.userAgent || fingerprint.user_agent || session.user_agent);
  const appPackage = normalizeHeaderValue("App-Package", args.appPackage) || fingerprint.app_package || session.app_package || ANDROID_APP_PACKAGE;
  const appVersion = normalizeHeaderValue("X-App-Version", args.appVersion) || fingerprint.app_version || session.app_version || ANDROID_APP_VERSION;
  const deviceId = normalizeHeaderValue("X-Device-Id", args.deviceId) || fingerprint.device_id || session.device_id || generateDeviceId();
  const appToken = normalizeHeaderValue("X-App-Token", args.appToken) || fingerprint.app_token || session.app_token || buildAppToken(deviceId, appPackage);
  const cookieStore = parseCookieHeader(String(session.cookie || ""));
  const getHeaders = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: `${BASE_URL}/`,
    Connection: "keep-alive",
    "X-App-Token": appToken,
    "X-App-Version": appVersion,
    "X-Device-Id": deviceId,
  };
  const existingCookie = cookieDictToHeader(cookieStore);
  if (existingCookie) getHeaders.Cookie = existingCookie;
  const loginPage = await httpRequest(`${WEBAPP_URL}?pg=login`, {
    method: "GET",
    headers: getHeaders,
    timeout: 30,
  });
  updateCookieStoreFromSetCookie(cookieStore, getSetCookieArray(loginPage.headers), targetDomain);
  const bodyGet = loginPage.body.toString("utf8");
  const loginHash = extractLoginHash(bodyGet);
  if (loginPage.status >= 400 && !loginHash) throw new CliError(`Gagal memuat halaman login (HTTP ${loginPage.status}).`);
  if (!loginHash) {
    const [loggedIn] = looksLoggedIn(loginPage.finalUrl, bodyGet);
    if (loggedIn) {
      const saved = saveSessionCookie(cookieDictToHeader(cookieStore), {
        targetDomain,
        userAgent,
        xRequestedWith: args.xRequestedWith === undefined ? null : args.xRequestedWith,
        appPackage,
        appVersion,
        deviceId,
        appToken,
      });
      if (!quiet) {
        console.log(`Session disimpan: ${saved}`);
        console.log("Session sudah aktif, login tidak diperlukan.");
      }
      return 0;
    }
    throw new CliError("Form login tidak ditemukan pada halaman webphone.");
  }
  const captcha = extractLoginCaptcha(bodyGet);
  let captchaValues = [];
  if (captcha && captcha.options.length) {
    if (quiet && !args.allowCaptchaPrompt) {
      const assets = saveCaptchaAssets(captcha);
      await sendCaptchaPreviewToTelegram(captcha, assets, { sessionExpired: true });
      throw new CliError("Login ulang membutuhkan CAPTCHA, tetapi proses ini tidak memiliki terminal interaktif untuk menerima pilihan nomor.");
    }
    if (quiet) console.log("[RELOGIN] CAPTCHA muncul. Credentials tersedia, silakan pilih nomor CAPTCHA untuk login ulang.");
    captchaValues = await promptCaptchaSelection(captcha);
  }
  const postParams = new URLSearchParams();
  postParams.set("login", email);
  postParams.set("password", password);
  for (const value of captchaValues) postParams.append("capcha[]", value);
  postParams.set("hash", loginHash);
  postParams.set("ajax_func", "login");
  const postBody = Buffer.from(postParams.toString(), "utf8");
  const postHeaders = {
    "User-Agent": userAgent,
    Accept: "*/*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    Origin: BASE_URL,
    Referer: `${WEBAPP_URL}?pg=login`,
    Connection: "keep-alive",
    "X-Requested-With": "XMLHttpRequest",
    "X-App-Token": appToken,
    "X-App-Version": appVersion,
    "X-Device-Id": deviceId,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Cookie: cookieDictToHeader(cookieStore),
  };
  const loginPost = await httpRequest(new URL("ajax/ajax_login.php", WEBAPP_URL).toString(), {
    method: "POST",
    headers: postHeaders,
    data: postBody,
    timeout: 30,
    maxBodyBytes: 500000,
  });
  updateCookieStoreFromSetCookie(cookieStore, getSetCookieArray(loginPost.headers), targetDomain);
  const bodyPost = loginPost.body.toString("utf8");
  const errorMessage = extractErrorMessage(bodyPost);
  const [statusFinal, finalUrl, bodyFinal] = await makeRequest(WEBAPP_URL, {
    cookieStore,
    cookieDomain: targetDomain,
    userAgent,
    xRequestedWith: args.xRequestedWith === undefined ? null : args.xRequestedWith,
    appToken,
    appVersion,
    deviceId,
  });
  const [loggedIn, reason] = looksLoggedIn(finalUrl, bodyFinal);
  if (loggedIn) {
    const saved = saveSessionCookie(cookieDictToHeader(cookieStore), {
      targetDomain,
      userAgent,
      xRequestedWith: args.xRequestedWith === undefined ? null : args.xRequestedWith,
      appPackage,
      appVersion,
      deviceId,
      appToken,
    });
    const sessionSaved = readJson(saved) || {};
    sessionSaved.login_email = email;
    sessionSaved.updated_at = nowUtc();
    atomicWriteJson(saved, sessionSaved);
    if (!quiet) console.log(`Session disimpan: ${saved}`);
    if (!quiet) console.log("Login otomatis berhasil.");
    return 0;
  }
  if (errorMessage) throw new CliError(`Login gagal: ${errorMessage}`);
  if (loginPost.status >= 400) throw new CliError(`Login gagal (HTTP ${loginPost.status}).`);
  throw new CliError(`Login belum berhasil. Status webphone: HTTP ${statusFinal}, alasan: ${reason}`);
}

async function cmdLogin(args) {
  if (args.cookie || args.cookieFile) {
    const session = loadSession(false) || {};
    const fingerprint = loadFingerprint(false) || {};
    const targetDomain = args.domain || DEFAULT_COOKIE_DOMAIN;
    const userAgent = normalizeUserAgent(args.userAgent || fingerprint.user_agent || session.user_agent);
    const appPackage = normalizeHeaderValue("App-Package", args.appPackage) || fingerprint.app_package || session.app_package || ANDROID_APP_PACKAGE;
    const appVersion = normalizeHeaderValue("X-App-Version", args.appVersion) || fingerprint.app_version || session.app_version || ANDROID_APP_VERSION;
    const deviceId = normalizeHeaderValue("X-Device-Id", args.deviceId) || fingerprint.device_id || session.device_id || generateDeviceId();
    const appToken = normalizeHeaderValue("X-App-Token", args.appToken) || fingerprint.app_token || session.app_token || buildAppToken(deviceId, appPackage);
    const rawCookie = args.cookieFile ? fs.readFileSync(path.resolve(expandHome(args.cookieFile)), "utf8") : args.cookie;
    const saved = saveSessionCookie(rawCookie, {
      targetDomain,
      userAgent,
      xRequestedWith: args.xRequestedWith === undefined ? null : args.xRequestedWith,
      appPackage,
      appVersion,
      deviceId,
      appToken,
    });
    console.log(`Session disimpan: ${saved}`);
    console.log("Jalankan `seotask status` untuk verifikasi session.");
    return 0;
  }
  const email = String(args.email !== undefined ? args.email : await prompt("EMAIL: ")).trim();
  const password = String(args.password !== undefined ? args.password : await prompt("PASSWORD: ")).trim();
  if (!email || !password) throw new CliError("Gunakan: seotask login --email 'email@mail.com' --password 'password'");
  return runLoginWithCredentials(args, email, password);
}

function prompt(question) {
  let input = process.stdin;
  let output = process.stdout;
  let closeTty = null;
  if (!process.stdin.isTTY) {
    try {
      const inputFd = fs.openSync("/dev/tty", "r");
      const outputFd = fs.openSync("/dev/tty", "w");
      input = fs.createReadStream(null, { fd: inputFd, autoClose: true });
      output = fs.createWriteStream(null, { fd: outputFd, autoClose: true });
      closeTty = () => {
        input.destroy();
        output.end();
      };
    } catch (_) {
      input = process.stdin;
      output = process.stdout;
    }
  }
  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    if (closeTty) closeTty();
    resolve(answer);
  }));
}

async function cmdCreds(args) {
  if (args.action === "status") {
    const creds = loadCredentials(false);
    if (!creds) {
      console.log("Credentials: belum diset.");
      return 1;
    }
    console.log("Credentials: tersedia");
    console.log(`Email: ${creds.email}`);
    console.log(`Password: ${creds.password}`);
    return 0;
  }
  const email = String(await prompt("Email: ")).trim();
  const password = String(await prompt("Password: ")).trim();
  const saved = saveCredentials(email, password);
  console.log(`Credentials tersimpan: ${saved}`);
  return 0;
}

async function cmdVersion() {
  console.log(`SeoTask App CLI ${CLI_VERSION}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Arch: ${releaseArchText()}`);
  console.log(`Binary: ${binaryPath()}`);
  console.log(`Config: ${configDir()}`);
  return 0;
}

async function cmdFingerprint(args) {
  const action = args.action;
  if (action === "presets") {
    console.log("Preset fingerprint tersedia:");
    for (const name of fingerprintPresetNames()) {
      console.log(`- ${name}: ${FINGERPRINT_PRESETS[name].label}`);
    }
    return 0;
  }
  if (action === "show") {
    const fingerprint = loadFingerprint(true);
    console.log(`Fingerprint file: ${fingerprintPath()}`);
    console.log("");
    printFingerprint(fingerprint);
    return 0;
  }
  if (action === "reset") {
    if (!args.yes) {
      console.log(`Fingerprint yang akan dihapus: ${fingerprintPath()}`);
      const answer = String(await prompt("Ketik RESET untuk menghapus fingerprint: ")).trim();
      if (answer !== "RESET") {
        console.log("Reset fingerprint dibatalkan.");
        return 1;
      }
    }
    try {
      fs.unlinkSync(fingerprintPath());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    console.log("Fingerprint dihapus.");
    return 0;
  }
  if (action !== "init") throw new UsageError("argument action: invalid choice");

  const selected = [args.random ? "random" : null, args.preset ? "preset" : null, args.device ? "device" : null].filter(Boolean);
  if (selected.length > 1) throw new UsageError("gunakan salah satu: --random, --preset, atau --device");
  const existing = loadFingerprint(false);
  if (existing && !args.force) {
    console.log("Fingerprint sudah ada:");
    printFingerprint(existing);
    console.log("");
    console.log("Gunakan `seotask fingerprint init --force` jika ingin membuat ulang.");
    return 0;
  }

  while (true) {
    const fingerprint = buildFingerprint({
      preset: args.preset,
      device: args.device,
      allowCustom: true,
    });
    console.log("Fingerprint baru:");
    console.log("");
    if (args.yes) {
      printFingerprint(fingerprint);
      const saved = saveFingerprint(fingerprint);
      console.log("");
      console.log(`Fingerprint tersimpan: ${saved}`);
      return 0;
    }
    const decision = await confirmFingerprint(fingerprint, true);
    if (decision === "yes") {
      const saved = saveFingerprint(fingerprint);
      console.log(`Fingerprint tersimpan: ${saved}`);
      return 0;
    }
    if (decision === "regenerate") {
      console.log("");
      continue;
    }
    console.log("Setup fingerprint dibatalkan.");
    return 1;
  }
}

async function cmdStatus(args) {
  const session = loadSession(true);
  const fingerprint = loadFingerprint(false) || {};
  const verbose = Boolean(args.verbose);
  const userAgent = normalizeUserAgent(args.userAgent || fingerprint.user_agent || session.user_agent);
  let xRequestedWith = args.xRequestedWith;
  if (xRequestedWith === undefined) xRequestedWith = Object.prototype.hasOwnProperty.call(session, "x_requested_with") ? session.x_requested_with : fingerprint.x_requested_with;
  const appPackage = normalizeHeaderValue("App-Package", args.appPackage || fingerprint.app_package || session.app_package);
  const appVersion = normalizeHeaderValue("X-App-Version", args.appVersion || fingerprint.app_version || session.app_version);
  const deviceId = normalizeHeaderValue("X-Device-Id", args.deviceId || fingerprint.device_id || session.device_id);
  let appToken = normalizeHeaderValue("X-App-Token", args.appToken || fingerprint.app_token || session.app_token);
  if (deviceId && appPackage && !appToken) appToken = buildAppToken(deviceId, appPackage);
  const cookieStore = parseCookieHeader(String(session.cookie || ""));
  const cookieBefore = cookieDictToHeader(cookieStore);
  const [status, finalUrl, body] = await makeRequest(WEBAPP_URL, {
    cookieStore,
    cookieDomain: DEFAULT_COOKIE_DOMAIN,
    userAgent,
    xRequestedWith,
    appToken,
    appVersion,
    deviceId,
  });
  const cookieAfter = cookieDictToHeader(cookieStore);
  if (cookieAfter && cookieAfter !== cookieBefore) {
    saveSessionCookie(cookieAfter, {
      targetDomain: DEFAULT_COOKIE_DOMAIN,
      userAgent,
      xRequestedWith,
      appPackage,
      appVersion,
      deviceId,
      appToken,
    });
  }
  let [loggedIn, reason] = looksLoggedIn(finalUrl, body);
  if (status === 403) {
    loggedIn = false;
    reason = "Server mengembalikan 403 (forbidden). Cookie valid tetapi fingerprint request belum cocok dengan aplikasi Android.";
  }
  console.log(`HTTP: ${status}`);
  console.log(`URL akhir: ${finalUrl}`);
  console.log(`Title: ${pageTitle(body)}`);
  console.log(`Session: ${loggedIn ? "kemungkinan valid" : "belum terverifikasi"}`);
  console.log(`Alasan: ${reason}`);
  console.log(taskStatusLine());
  if (loggedIn) {
    const info = extractAccountInfo(body);
    if (info.account_name) console.log(`Akun: ${info.account_name}`);
    if (info.balance_rub) console.log(`Saldo: ${info.balance_rub} RUB`);
  }
  if (verbose) {
    console.log(`User-Agent: ${userAgent}`);
    console.log(`X-Requested-With: ${xRequestedWith || "(tidak dikirim)"}`);
    console.log(`X-App-Version: ${appVersion || "(tidak dikirim)"}`);
    console.log(`X-Device-Id: ${deviceId || "(tidak dikirim)"}`);
    console.log(`X-App-Token: ${appToken || "(tidak dikirim)"}`);
    const text = stripHtmlText(body);
    console.log("\nCuplikan halaman:");
    console.log(text.length > 900 ? `${text.slice(0, 896)} ...` : text);
  }
  return loggedIn ? 0 : 2;
}

function runSystemctl(args) {
  return spawnSync("systemctl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function commandExists(command) {
  const result = spawnSync("sh", ["-c", `command -v ${command}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return result.status === 0;
}

function systemdAvailable() {
  return commandExists("systemctl") && fs.existsSync("/run/systemd/system");
}

function serviceActiveStatus() {
  return (runSystemctl(["is-active", SERVICE_NAME]).stdout || "").trim() || "unknown";
}

function serviceEnabledStatus() {
  return (runSystemctl(["is-enabled", SERVICE_NAME]).stdout || "").trim() || "unknown";
}

function serviceUnitExists() {
  return fs.existsSync(SERVICE_PATH);
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

function isRoot() {
  return typeof process.getuid === "function" ? process.getuid() === 0 : false;
}

async function cmdService(args) {
  const action = args.action;
  if (action === "status") {
    const active = serviceActiveStatus();
    const enabled = serviceEnabledStatus();
    console.log(`Service file: ${SERVICE_PATH}`);
    console.log(`Active: ${active}`);
    console.log(`Enabled: ${enabled}`);
    console.log(taskStatusLine());
    return ["active", "activating"].includes(active) ? 0 : 1;
  }
  if (!isRoot()) throw new CliError("Aksi service ini butuh root. Jalankan dengan sudo.");
  if (action === "install") {
    fs.writeFileSync(SERVICE_PATH, serviceUnitText(), "utf8");
    runSystemctl(["daemon-reload"]);
    const enable = runSystemctl(["enable", "--now", SERVICE_NAME]);
    if (enable.status !== 0) throw new CliError((enable.stderr || "").trim() || "Gagal enable/start service.");
    console.log(`Service terpasang: ${SERVICE_PATH}`);
    console.log("Service aktif dan auto-start saat VPS reboot.");
    return 0;
  }
  if (action === "start") {
    const start = runSystemctl(["start", SERVICE_NAME]);
    if (start.status !== 0) throw new CliError((start.stderr || "").trim() || "Gagal start service.");
    console.log("Service dimulai.");
    return 0;
  }
  if (action === "stop") {
    const state = readJson(statePath()) || {};
    Object.assign(state, { running: false, stopped_at: nowUtc(), current_task_running: false, last_status: "STOP", last_message: "Service stop" });
    atomicWriteJson(statePath(), state);
    const stop = runSystemctl(["stop", SERVICE_NAME]);
    if (stop.status !== 0) throw new CliError((stop.stderr || "").trim() || "Gagal stop service.");
    console.log("Service dihentikan.");
    return 0;
  }
  if (action === "restart") {
    const state = readJson(statePath()) || {};
    Object.assign(state, { running: false, stopped_at: nowUtc(), current_task_running: false, last_status: "STOP", last_message: "Service restart" });
    atomicWriteJson(statePath(), state);
    const restart = runSystemctl(["restart", SERVICE_NAME]);
    if (restart.status !== 0) throw new CliError((restart.stderr || "").trim() || "Gagal restart service.");
    console.log("Service direstart.");
    return 0;
  }
  if (action === "uninstall") {
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
  throw new CliError("Aksi service tidak dikenal.");
}

function resolveRuntimeProfile(args, session) {
  const fingerprint = loadFingerprint(false) || {};
  const userAgent = normalizeUserAgent(args.userAgent || fingerprint.user_agent || session.user_agent);
  let xRequestedWith = args.xRequestedWith;
  if (xRequestedWith === undefined) xRequestedWith = Object.prototype.hasOwnProperty.call(session, "x_requested_with") ? session.x_requested_with : fingerprint.x_requested_with;
  xRequestedWith = normalizeHeaderValue("X-Requested-With", xRequestedWith);
  let appPackage = normalizeHeaderValue("App-Package", args.appPackage || fingerprint.app_package || session.app_package);
  if (!appPackage) appPackage = ANDROID_APP_PACKAGE;
  let appVersion = normalizeHeaderValue("X-App-Version", args.appVersion || fingerprint.app_version || session.app_version);
  if (!appVersion) appVersion = ANDROID_APP_VERSION;
  let deviceId = normalizeHeaderValue("X-Device-Id", args.deviceId || fingerprint.device_id || session.device_id);
  if (!deviceId) deviceId = generateDeviceId();
  let appToken = normalizeHeaderValue("X-App-Token", args.appToken || fingerprint.app_token || session.app_token);
  if (!appToken) appToken = buildAppToken(deviceId, appPackage);
  return {
    user_agent: userAgent,
    x_requested_with: xRequestedWith,
    app_package: appPackage,
    app_version: appVersion,
    device_id: deviceId,
    app_token: appToken,
    fingerprint_preset: fingerprint.preset || null,
    fingerprint_label: fingerprint.label || null,
    hardware: fingerprint.hardware || null,
    os: fingerprint.os || null,
    display: fingerprint.display || null,
    locale: fingerprint.locale || null,
    timezone: fingerprint.timezone || null,
    extra: fingerprint.extra || null,
  };
}

function runnerIsActive(options = {}) {
  const state = readJson(statePath()) || {};
  if (!state.running) return false;
  if (state.pid && Number.parseInt(state.pid, 10) !== process.pid && !processAlive(state.pid)) {
    if (options.recover) recoverStaleRunnerState(`Stale state dibersihkan, PID lama ${state.pid} sudah mati.`, options.log !== false);
    return false;
  }
  return true;
}

function parseJsonObject(body, endpoint) {
  const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body || "");
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new CliError(`Respons ${endpoint} bukan JSON valid: ${text.slice(0, 220)}`);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new CliError(`Respons ${endpoint} tidak berbentuk object JSON.`);
  }
  return payload;
}

function buildHeadlessDeviceJson(profile) {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "id-ID";
  const parts = locale.split(/[-_]/);
  const hardware = profile.hardware || {
    brand: "google",
    model: "Pixel 7",
    device: "panther",
    hardware: "google",
    manufacturer: "Google",
    product: "panther",
    board: "panther",
  };
  const osInfo = profile.os || { sdk_int: 33, release: "13", incremental: "headless" };
  const display = profile.display || { width_px: 1080, height_px: 2400, density_dpi: 420, density: 2.625 };
  const profileLocale = profile.locale || { language: parts[0] || "id", country: parts[1] || "ID", variant: "" };
  const extra = profile.extra || {
    fingerprint: "google/panther/panther:13/TQ3A.230901.001/1234567:user/release-keys",
    tags: "release-keys",
    type: "user",
    user: "android-build",
    host: "abfarm",
  };
  const deviceJson = {
    device_id: profile.device_id,
    device_type: "device",
    is_emulator: false,
    is_secure: false,
    timestamp: Date.now(),
    hardware,
    os: osInfo,
    display,
    locale: profileLocale,
    timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    extra,
  };
  return JSON.stringify(deviceJson);
}

async function fetchWebappHash(profile, cookieStore, timeout) {
  const headers = {
    "User-Agent": String(profile.user_agent),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: `${BASE_URL}/`,
    Connection: "keep-alive",
    "X-App-Token": String(profile.app_token),
    "X-App-Version": String(profile.app_version),
    "X-Device-Id": String(profile.device_id),
  };
  if (profile.x_requested_with) headers["X-Requested-With"] = String(profile.x_requested_with);
  const cookieHeader = cookieDictToHeader(cookieStore);
  if (cookieHeader) headers.Cookie = cookieHeader;
  const response = await httpRequest(WEBAPP_URL, {
    method: "GET",
    headers,
    timeout,
    maxBodyBytes: 1500000,
  });
  updateCookieStoreFromSetCookie(cookieStore, getSetCookieArray(response.headers));
  const body = response.body.toString("utf8");
  return [response.status, response.finalUrl, body, extractLoginHash(body) || ""];
}

async function postWebappJson(endpointPath, payload, profile, cookieStore, options = {}) {
  const headers = {
    "User-Agent": String(profile.user_agent),
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    Origin: BASE_URL,
    Referer: options.referer || `${BASE_URL}/`,
    Connection: "keep-alive",
    "X-Requested-With": "XMLHttpRequest",
    "X-App-Token": String(profile.app_token),
    "X-App-Version": String(profile.app_version),
    "X-Device-Id": String(profile.device_id),
    "Content-Type": "application/json; charset=utf-8",
  };
  const cookieHeader = cookieDictToHeader(cookieStore);
  if (cookieHeader) headers.Cookie = cookieHeader;
  const response = await httpRequest(new URL(endpointPath, WEBAPP_URL).toString(), {
    method: "POST",
    headers,
    data: Buffer.from(JSON.stringify(payload), "utf8"),
    timeout: options.timeout || 30,
    maxBodyBytes: 800000,
  });
  updateCookieStoreFromSetCookie(cookieStore, getSetCookieArray(response.headers));
  if (response.status >= 500) {
    throw new CliError(`Server error HTTP ${response.status} di ${endpointPath}: ${response.body.toString("utf8").slice(0, 220)}`);
  }
  return [response.status, parseJsonObject(response.body, endpointPath)];
}

function saveCookieStoreToSession(cookieStore, profile, targetDomain = DEFAULT_COOKIE_DOMAIN) {
  const cookieHeader = cookieDictToHeader(cookieStore);
  if (!cookieHeader) return;
  saveSessionCookie(cookieHeader, {
    targetDomain,
    userAgent: String(profile.user_agent),
    xRequestedWith: profile.x_requested_with ? String(profile.x_requested_with) : null,
    appPackage: String(profile.app_package),
    appVersion: String(profile.app_version),
    deviceId: String(profile.device_id),
    appToken: String(profile.app_token),
  });
}

async function touchYoutubeUrl(url, userAgent, youtubeCookie, timeout) {
  const headers = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  };
  if (youtubeCookie) headers.Cookie = youtubeCookie;
  try {
    const response = await httpRequest(url, { method: "GET", headers, timeout, maxBodyBytes: 200000 });
    return response.status;
  } catch (_) {
    return null;
  }
}

async function countdownUntilDone(seconds) {
  let remaining = Math.max(0, Number.parseInt(seconds, 10) || 0);
  while (remaining > 0) {
    if (!runnerIsActive()) {
      process.stdout.write(`\n[${nowLocal()}] Stop diminta, countdown dibatalkan.\n`);
      return false;
    }
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    process.stdout.write(`\rCountdown: ${mm}:${ss}`);
    await sleep(1000);
    remaining -= 1;
  }
  process.stdout.write("\rCountdown: 00:00\n");
  return true;
}

function updateRunnerState(patch) {
  const state = readJson(statePath()) || {};
  Object.assign(state, patch, { updated_at: nowUtc() });
  atomicWriteJson(statePath(), state);
}

async function countdownTask(seconds, taskInfo) {
  let remaining = Math.max(0, Number.parseInt(seconds, 10) || 0);
  while (remaining > 0) {
    if (!runnerIsActive()) {
      process.stdout.write(`\n${nowLogPrefix()} Stop diminta, countdown dibatalkan.\n`);
      return false;
    }
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    process.stdout.write(`\rCountdown: ${mm}:${ss}`);
    await sleep(1000);
    remaining -= 1;
  }
  process.stdout.write("\rCountdown: 00:00\n");
  return true;
}

async function waitWithStop(seconds) {
  for (let i = 0; i < Math.max(0, Number.parseInt(seconds, 10) || 0); i += 1) {
    if (!runnerIsActive()) return false;
    await sleep(1000);
  }
  return true;
}

function registerRunnerSignalHandlers() {
  let handled = false;
  const cleanup = (signal) => {
    if (handled) return;
    handled = true;
    const state = readJson(statePath()) || {};
    Object.assign(state, {
      running: false,
      current_task_running: false,
      stopped_at: nowUtc(),
      last_status: "STOP",
      last_message: `Signal ${signal}`,
      updated_at: nowUtc(),
    });
    atomicWriteJson(statePath(), state);
    appendLogLine(`${nowLogPrefix()} [STOP] Signal ${signal}, runner dihentikan.`);
  };
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.once(signal, () => cleanup(signal));
  }
}

async function cmdStart(args) {
  if (!args.serviceRun && serviceUnitExists()) {
    const active = serviceActiveStatus();
    if (["active", "activating"].includes(active)) {
      console.log("Service SeoTask sudah aktif.");
      console.log(taskStatusLine());
      return 0;
    }
    if (!isRoot()) {
      throw new CliError("SeoTask terpasang sebagai service. Jalankan `sudo seotask start` atau `sudo seotask service start`.");
    }
    const start = runSystemctl(["start", SERVICE_NAME]);
    if (start.status !== 0) throw new CliError((start.stderr || "").trim() || "Gagal start service.");
    console.log("Service SeoTask dimulai.");
    return 0;
  }
  let session = loadSession(true);
  if (runnerIsActive({ recover: true })) throw new CliError("Runner sedang berjalan. Jalankan `seotask stop` dulu jika ingin restart.");
  registerRunnerSignalHandlers();
  const domain = args.domain || DEFAULT_COOKIE_DOMAIN;
  const profile = resolveRuntimeProfile(args, session);
  const cookieStore = parseCookieHeader(String(session.cookie || ""));
  if (!Object.keys(cookieStore).length) throw new CliError("Cookie session kosong. Jalankan login ulang.");
  let youtubeCookie = null;
  if (args.youtubeCookieFile) youtubeCookie = readCookieFile(args.youtubeCookieFile, "youtube.com");
  const timeout = Math.max(5, Number.parseInt(args.timeout, 10) || 30);
  const pollInterval = Math.max(1, Number.parseInt(args.pollInterval, 10) || 20);
  const postTaskDelay = Math.max(0, Number.parseInt(args.postTaskDelay, 10) || 2);
  const maxTasks = Math.max(0, Number.parseInt(args.maxTasks, 10) || 0);
  let loginEmail = String(session.login_email || "").trim();
  const creds = loadCredentials(false);
  const state = {
    running: true,
    started_at: nowUtc(),
    webapp_url: WEBAPP_URL,
    mode: "headless",
    pid: process.pid,
    processed_tasks: 0,
    log_path: logPath(),
    current_task_running: false,
    last_error: null,
  };
  atomicWriteJson(statePath(), state);
  logEvent("Runner headless: START");
  logEvent(`State disimpan: ${statePath()}`);
  logEvent(`Endpoint: ${WEBAPP_URL}`);

  let processed = 0;
  let upDataSynced = Boolean(args.skipUpData);
  let deviceFallbackTried = false;
  let deviceJson = buildHeadlessDeviceJson(profile);
  let lastReloginAttempt = 0;

  const tryAutoRelogin = async (trigger) => {
    const notifyRelogin = async (status, message = "") => {
      try {
        await sendReloginTelegramNotification(status, { trigger, message, email: loginEmail || (creds && creds.email) || "" });
      } catch (error) {
        logEvent(`[TELEGRAM] Gagal kirim notifikasi relogin: ${error.message || error}`);
      }
    };
    if (!creds) {
      logEvent("[RELOGIN] Credentials belum tersedia (`seotask creds`).");
      await notifyRelogin("Gagal", "Credentials belum tersedia. Jalankan `seotask creds` atau `seotask credentials`.");
      return false;
    }
    const now = Date.now() / 1000;
    if (now - lastReloginAttempt < 15) {
      logEvent("[RELOGIN] Menunggu cooldown relogin...");
      return false;
    }
    lastReloginAttempt = now;
    logEvent(`[RELOGIN] Trigger: ${trigger}`);
    const reloginArgs = {
      domain,
      userAgent: profile.user_agent,
      xRequestedWith: profile.x_requested_with,
      appPackage: profile.app_package,
      appVersion: profile.app_version,
      deviceId: profile.device_id,
      appToken: profile.app_token,
      allowCaptchaPrompt: Boolean(!args.serviceRun && process.stdin.isTTY && process.stdout.isTTY),
    };
    try {
      await runLoginWithCredentials(reloginArgs, creds.email, creds.password, true);
    } catch (error) {
      logEvent(`[RELOGIN] Gagal: ${error.message || error}`);
      const message = String(error.message || error);
      await notifyRelogin(message.includes("CAPTCHA") ? "Gagal - CAPTCHA" : "Gagal", message);
      return false;
    }
    session = loadSession(true);
    Object.assign(profile, resolveRuntimeProfile(args, session));
    for (const key of Object.keys(cookieStore)) delete cookieStore[key];
    Object.assign(cookieStore, parseCookieHeader(String(session.cookie || "")));
    if (!Object.keys(cookieStore).length) {
      logEvent("[RELOGIN] Gagal: cookie kosong setelah relogin.");
      return false;
    }
    loginEmail = String(session.login_email || "").trim();
    upDataSynced = Boolean(args.skipUpData);
    deviceFallbackTried = false;
    deviceJson = buildHeadlessDeviceJson(profile);
    logEvent("[RELOGIN] Berhasil login ulang, runner dilanjutkan.");
    await notifyRelogin("Berhasil", "Session berhasil diperbarui dan runner dilanjutkan.");
    return true;
  };

  try {
    while (runnerIsActive()) {
      let homeStatus;
      let finalUrl;
      let body;
      let hashAjax;
      try {
        [homeStatus, finalUrl, body, hashAjax] = await fetchWebappHash(profile, cookieStore, timeout);
      } catch (error) {
        if (isTransientRunnerError(error.message)) {
          logEvent(`[RETRY] ${error.message}`);
          if (!(await waitWithStop(Math.min(5, pollInterval)))) break;
          continue;
        }
        throw error;
      }
      const [loggedIn, reason] = looksLoggedIn(finalUrl, body);
      if (!loggedIn) {
        if (await tryAutoRelogin(reason)) continue;
        throw new CliError(`Sesi login berakhir saat start: ${reason}`);
      }
      if (!hashAjax) {
        throw new CliError("Hash AJAX tidak ditemukan di halaman webphone. Kemungkinan format halaman berubah atau hash tidak lagi tersedia pada HTML utama.");
      }
      if (homeStatus === 403) throw new CliError("Akses webphone ditolak 403 saat proses start.");
      saveCookieStoreToSession(cookieStore, profile, domain);

      if (!upDataSynced) {
        const upPayload = {
          ajax_func: "up_data",
          hash_ajax: hashAjax,
          id_device: profile.device_id,
          email: loginEmail,
          data_json: deviceJson,
        };
        let upStatus;
        let upResult;
        try {
          [upStatus, upResult] = await postWebappJson("ajax/ajax_data.php", upPayload, profile, cookieStore, { timeout });
        } catch (error) {
          if (isTransientRunnerError(error.message)) {
            logEvent(`[RETRY] ${error.message}`);
            if (!(await waitWithStop(Math.min(5, pollInterval)))) break;
            continue;
          }
          throw error;
        }
        if (args.verbose) logEvent(`[UP_DATA] HTTP ${upStatus} | status=${upResult.status}`);
        if (Boolean(upResult.status)) upDataSynced = true;
      }

      const getPayload = { ajax_func: "get_task", hash_ajax: hashAjax };
      let getStatus;
      let getResult;
      try {
        [getStatus, getResult] = await postWebappJson("ajax/ajax_views.php", getPayload, profile, cookieStore, { timeout });
      } catch (error) {
        if (isTransientRunnerError(error.message)) {
          logEvent(`[RETRY] ${error.message}`);
          if (!(await waitWithStop(Math.min(5, pollInterval)))) break;
          continue;
        }
        throw error;
      }
      if (getStatus === 403) throw new CliError("Endpoint get_task ditolak (403).");
      if (!Boolean(getResult.status)) {
        const mess = String(getResult.mess || "Tidak ada task saat ini.");
        logEvent(`[WAIT] ${mess}`);
        const currentState = readJson(statePath()) || {};
        Object.assign(currentState, {
          last_status: "WAIT",
          last_message: mess,
          last_wait_at: nowUtc(),
          current_task_running: false,
          updated_at: nowUtc(),
        });
        atomicWriteJson(statePath(), currentState);
        saveCookieStoreToSession(cookieStore, profile, domain);
        const lower = mess.toLowerCase();
        if (lower.includes("error device")) {
          const fallbackId = alternateDeviceId(profile.device_id);
          if (fallbackId && !deviceFallbackTried) {
            deviceFallbackTried = true;
            profile.device_id = fallbackId;
            profile.app_token = buildAppToken(fallbackId, profile.app_package);
            deviceJson = buildHeadlessDeviceJson(profile);
            upDataSynced = Boolean(args.skipUpData);
            logEvent(`[INFO] Fallback id_device dicoba: ${fallbackId}`);
            saveCookieStoreToSession(cookieStore, profile, domain);
            if (!(await waitWithStop(1))) break;
            continue;
          }
          throw new CliError(`Server menolak perangkat (${mess}). Fingerprint device CLI tidak diterima server.`);
        }
        if (lower.includes("\u0430\u0432\u0442\u043e\u0440\u0438\u0437") || lower.includes("authoriz")) {
          if (await tryAutoRelogin(mess)) continue;
          throw new CliError(`Server menolak get_task: ${mess}`);
        }
        if (!(await waitWithStop(pollInterval))) break;
        continue;
      }

      const taskUrl = String(getResult.url || "").trim();
      const timer = Number.parseInt(getResult.timer || 0, 10);
      const idStatus = Number.parseInt(getResult.id_status || 0, 10);
      const videoId = String(getResult.video_id || "-");
      if (!taskUrl || timer <= 0 || idStatus <= 0) {
        logEvent(`[WARN] Respons task tidak lengkap: ${JSON.stringify(getResult)}`);
        updateRunnerState({ last_status: "WARN", last_message: "Respons task tidak lengkap", current_task_running: false });
        if (!(await waitWithStop(pollInterval))) break;
        continue;
      }
      updateRunnerState({
        last_status: "TASK",
        last_message: `video=${videoId} | timer=${timer}s | id_status=${idStatus}`,
        current_task_running: true,
        current_task_started_at: nowUtc(),
        current_task_video_id: videoId,
        current_task_id_status: idStatus,
        current_task_timer: timer,
        current_task_url: taskUrl,
      });
      logEvent(`[TASK] video=${videoId} | timer=${timer}s | id_status=${idStatus}`);
      if (args.verbose) logEvent(`[URL] ${taskUrl}`);
      if (!args.noYoutubeTouch) {
        const ytStatus = await touchYoutubeUrl(taskUrl, String(profile.user_agent), youtubeCookie, timeout);
        if (args.verbose) logEvent(`[YOUTUBE] status=${ytStatus === null ? "gagal" : ytStatus}`);
      }
      const finished = await countdownTask(timer, { idStatus, videoId });
      if (!finished) {
        const ignorePayload = { ajax_func: "ignor_task", id_status: String(idStatus), hash_ajax: hashAjax };
        const [, ignoreResult] = await postWebappJson("ajax/ajax_views.php", ignorePayload, profile, cookieStore, { timeout });
        logEvent(`[STOP] Task diabaikan: ${ignoreResult.mess || ignoreResult.status}`);
        updateRunnerState({ current_task_running: false, current_task_stopped_at: nowUtc() });
        break;
      }
      const completePayload = { ajax_func: "complete_task", id_status: String(idStatus), data_json: deviceJson, hash_ajax: hashAjax };
      let completeStatus;
      let completeResult;
      try {
        [completeStatus, completeResult] = await postWebappJson("ajax/ajax_views.php", completePayload, profile, cookieStore, { timeout });
      } catch (error) {
        if (isTransientRunnerError(error.message)) {
          logEvent(`[RETRY] ${error.message}`);
          if (!(await waitWithStop(Math.min(5, pollInterval)))) break;
          continue;
        }
        throw error;
      }
      if (completeStatus === 403) throw new CliError("Endpoint complete_task ditolak (403).");
      if (Boolean(completeResult.status)) {
        processed += 1;
        recordEarning(completeResult.price || 0, { idStatus, videoId });
        logEvent(`[DONE] reward=+${completeResult.price || 0} \u20bd | balance=${completeResult.balance || "?"}`);
      } else {
        logEvent(`[WARN] ${String(completeResult.mess || "complete_task gagal")}`);
      }
      const currentState = readJson(statePath()) || {};
      Object.assign(currentState, {
        last_status: Boolean(completeResult.status) ? "DONE" : "WARN",
        last_message: Boolean(completeResult.status)
          ? `reward=+${completeResult.price || 0} RUB | balance=${completeResult.balance || "?"}`
          : String(completeResult.mess || "complete_task gagal"),
        processed_tasks: processed,
        last_video_id: videoId,
        last_id_status: idStatus,
        last_reward: completeResult.price || 0,
        last_balance: completeResult.balance || "?",
        last_task_finished_at: nowUtc(),
        current_task_running: false,
        updated_at: nowUtc(),
      });
      atomicWriteJson(statePath(), currentState);
      saveCookieStoreToSession(cookieStore, profile, domain);
      if (maxTasks > 0 && processed >= maxTasks) {
        logEvent(`Batas max_tasks=${maxTasks} tercapai. Runner dihentikan.`);
        break;
      }
      if (postTaskDelay > 0 && !(await waitWithStop(postTaskDelay))) break;
    }
  } catch (error) {
    const currentState = readJson(statePath()) || {};
    Object.assign(currentState, { last_status: "ERROR", last_message: error.message || String(error), last_error: error.message || String(error), last_error_at: nowUtc(), updated_at: nowUtc() });
    atomicWriteJson(statePath(), currentState);
    logEvent(`[SESSION/ERROR] ${error.message || error}`);
    throw error;
  } finally {
    saveCookieStoreToSession(cookieStore, profile, domain);
    const finalState = readJson(statePath()) || {};
    Object.assign(finalState, { running: false, stopped_at: nowUtc(), processed_tasks: processed, current_task_running: false });
    atomicWriteJson(statePath(), finalState);
  }
  return 0;
}

async function cmdStop() {
  const state = readJson(statePath()) || {};
  const wasRunning = Boolean(state.running);
  Object.assign(state, { running: false, stopped_at: nowUtc(), current_task_running: false, last_status: "STOP", last_message: "Stop diminta" });
  atomicWriteJson(statePath(), state);
  logEvent(wasRunning ? "Runner headless: STOP diminta" : "Runner tidak aktif, state diset STOP.");
  if (serviceUnitExists()) {
    console.log("Runner diminta berhenti. Service tetap terpasang; gunakan `seotask start` untuk menjalankan lagi sebagai service.");
    console.log("Untuk menghentikan unit systemd sepenuhnya, gunakan `sudo seotask service stop`.");
  }
  return 0;
}

function printEmptyLogMessage() {
  console.log("Log masih kosong, silahkan jalankan task terlebih dulu");
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

async function cmdEarnings() {
  const today = todayEarnings();
  const last7 = sumEarnings(7);
  const last30 = sumEarnings(30);
  const total = sumEarnings(null);
  const avgDaily = last7.days ? roundRub(last7.rub / last7.days) : 0;
  const avgTask = averagePerTask(total);

  console.log("Earnings");
  console.log("");
  console.log(`Hari ini: ${today.rub} RUB / ${today.tasks} task`);
  console.log(`7 hari terakhir: ${last7.rub} RUB / ${last7.tasks} task`);
  console.log(`30 hari terakhir: ${last30.rub} RUB / ${last30.tasks} task`);
  console.log(`Total tercatat: ${total.rub} RUB / ${total.tasks} task`);
  console.log("");
  console.log(`Rata-rata harian (7 hari data terakhir): ${avgDaily} RUB`);
  console.log(`Rata-rata per task: ${avgTask} RUB`);
  if (!total.tasks) {
    console.log("");
    console.log("Belum ada pendapatan tercatat. Jalankan task terlebih dulu.");
    return 1;
  }
  return 0;
}

function normalizeNotifyTime(value) {
  const text = String(value || "06:00").trim();
  const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new UsageError("Format jadwal harus HH:MM, contoh: 06:00");
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeTimezone(value) {
  const timezone = String(value || "Asia/Jakarta").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch (_) {
    throw new UsageError(`Timezone tidak valid: ${timezone}`);
  }
  return timezone;
}

function maskSecret(value) {
  const text = String(value || "");
  if (text.length <= 8) return text ? "********" : "-";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

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

function datePartsInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, item) => {
    if (item.type !== "literal") result[item.type] = item.value;
    return result;
  }, {});
  return { year: parts.year, month: parts.month, day: parts.day };
}

function formatHumanDate(date, timezone, withTime = false) {
  const options = {
    timeZone: normalizeTimezone(timezone),
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  if (withTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = false;
    options.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat("en-GB", options).format(date).replace(",", "");
}

function previousDateKeyInTimezone(timezone) {
  const previous = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const parts = datePartsInTimezone(previous, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateKeyId(dateKey) {
  const [year, month, day] = String(dateKey).split("-");
  return `${day}-${month}-${year}`;
}

function formatDateKeyHuman(dateKey, timezone) {
  const [year, month, day] = String(dateKey).split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return String(dateKey);
  return formatHumanDate(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)), timezone, false);
}

function telegramLastLogText(config) {
  const last = lastRelevantLogLine();
  if (!last) return { line: "Log masih kosong", time: "-" };
  const line = last.text.length > 220 ? `${last.text.slice(0, 217)}...` : last.text;
  const time = last.date ? formatHumanDate(last.date, config.timezone || "Asia/Jakarta", true) : "-";
  return { line, time };
}

async function publicIpAddress() {
  try {
    const response = await httpRequest("https://api.ipify.org?format=json", {
      method: "GET",
      headers: { "User-Agent": `seotask/${CLI_VERSION}` },
      timeout: 8,
      retries: 1,
      ipv4Fallback: true,
      maxBodyBytes: 20000,
    });
    const data = JSON.parse(response.body.toString("utf8"));
    return String(data.ip || "-");
  } catch (_) {
    return "-";
  }
}

async function buildTelegramEarningsMessage(config) {
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

function removeTelegramCron() {
  if (!commandExists("crontab")) return false;
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
  if (!systemdAvailable() || !isRoot()) return false;
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

function installTelegramSystemd(config) {
  if (!systemdAvailable() || !isRoot()) return false;
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
    const current = spawnSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (current.status === 0 && String(current.stdout || "").includes("seotask-telegram")) return "cron aktif";
  }
  return "manual/tidak aktif";
}

async function cmdTelegram(args) {
  const action = args.action;
  if (action === "setup") {
    const botToken = String(args.botToken || await prompt("BOT_TOKEN: ")).trim();
    const chatId = String(args.chatId || await prompt("CHAT_ID: ")).trim();
    const time = normalizeNotifyTime(args.time || await prompt("Jadwal notifikasi harian (HH:MM, default 06:00): ") || "06:00");
    const timezone = normalizeTimezone(args.timezone || await prompt("Timezone (default Asia/Jakarta): ") || "Asia/Jakarta");
    if (!botToken || !chatId) throw new CliError("BOT_TOKEN dan CHAT_ID wajib diisi.");
    const config = {
      enabled: true,
      bot_token: botToken,
      chat_id: chatId,
      time,
      timezone,
      scheduler: "manual",
    };
    saveTelegramConfig(config);
    config.scheduler = configureTelegramSchedule(config);
    saveTelegramConfig(config);
    console.log(`Telegram config tersimpan: ${telegramPath()}`);
    console.log(`Scheduler: ${config.scheduler}`);
    if (config.scheduler === "manual") {
      console.log("Systemd timer/cron tidak tersedia atau tidak bisa dipasang. Jalankan manual: `seotask telegram send`.");
    }
    if (args.test) await cmdTelegram({ action: "test" });
    return 0;
  }
  if (action === "status") {
    const config = loadTelegramConfig(false);
    if (!config) {
      console.log("Telegram: belum diset.");
      console.log("Jalankan: seotask telegram setup");
      return 1;
    }
    console.log(`Enabled: ${Boolean(config.enabled)}`);
    console.log(`BOT_TOKEN: ${maskSecret(config.bot_token)}`);
    console.log(`CHAT_ID: ${config.chat_id || "-"}`);
    console.log(`Jadwal: ${config.time || "06:00"} ${config.timezone || "Asia/Jakarta"}`);
    console.log(`Scheduler: ${telegramScheduleStatus()}`);
    console.log(`Last sent: ${config.last_sent_at || "-"}`);
    return 0;
  }
  if (action === "test") {
    const config = loadTelegramConfig(true);
    const text = `Test Telegram SeoTask\n🖥️ ${os.hostname() || "-"}\nStatus: OK`;
    await sendTelegramMessage(config, text);
    console.log("Pesan test Telegram terkirim.");
    return 0;
  }
  if (action === "send") {
    const config = loadTelegramConfig(true);
    const text = await buildTelegramEarningsMessage(config);
    await sendTelegramMessage(config, text);
    saveTelegramConfig({ last_sent_at: nowUtc(), last_sent_date: previousDateKeyInTimezone(config.timezone || "Asia/Jakarta") });
    console.log("Laporan earnings Telegram terkirim.");
    return 0;
  }
  if (action === "disable") {
    const config = loadTelegramConfig(true);
    const scheduler = disableTelegramSchedule();
    saveTelegramConfig({ ...config, enabled: false, scheduler });
    console.log("Telegram notification dinonaktifkan.");
    return 0;
  }
  if (action === "enable") {
    const config = loadTelegramConfig(true);
    config.enabled = true;
    config.time = normalizeNotifyTime(config.time || "06:00");
    config.timezone = normalizeTimezone(config.timezone || "Asia/Jakarta");
    config.scheduler = configureTelegramSchedule(config);
    saveTelegramConfig(config);
    console.log(`Telegram notification diaktifkan. Scheduler: ${config.scheduler}`);
    if (config.scheduler === "manual") console.log("Jalankan manual: `seotask telegram send`.");
    return 0;
  }
  throw new UsageError("argument action: invalid choice");
}

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "").split(/[+-]/)[0];
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeVersion(b).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function serviceStatusValue(action) {
  const result = runSystemctl([action, SERVICE_NAME]);
  if (result.error) return "tidak tersedia";
  const text = (result.stdout || result.stderr || "").trim();
  if (!text) return "unknown";
  if (text.includes("System has not been booted with systemd")) return "tidak tersedia";
  return text.split(/\r?\n/)[0] || "unknown";
}

async function fetchLatestRelease() {
  const response = await httpRequest(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    method: "GET",
    headers: {
      "User-Agent": `seotask/${CLI_VERSION}`,
      Accept: "application/vnd.github+json",
    },
    timeout: 30,
    retries: 2,
    maxBodyBytes: 1000000,
  });
  if (response.status >= 400) throw new CliError(`Gagal cek release GitHub (HTTP ${response.status}).`);
  let payload;
  try {
    payload = JSON.parse(response.body.toString("utf8"));
  } catch (error) {
    throw new CliError(`Respons release GitHub bukan JSON valid: ${error.message}`);
  }
  if (!payload || typeof payload !== "object" || !payload.tag_name) {
    throw new CliError("Respons release GitHub tidak memiliki tag release.");
  }
  return payload;
}

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

async function cmdHealth() {
  const health = analyzeRunnerHealth();
  const state = health.state;
  console.log("SeoTask Health");
  console.log("");
  console.log(`Service: ${health.serviceActive}`);
  console.log(`Service enabled: ${health.serviceEnabled}`);
  console.log(`Runner: ${health.runner}`);
  console.log(`Health: ${health.health}`);
  console.log(`PID: ${health.pid || "-"}${health.pid ? ` (${health.pidAlive ? "alive" : "dead"})` : ""}`);
  console.log(taskStatusLine());
  if (state.last_status) console.log(`Last status: ${state.last_status}`);
  if (state.last_message) console.log(`Last message: ${state.last_message}`);
  if (state.updated_at) console.log(`State updated: ${formatStateTime(state.updated_at)}${health.updatedAge !== null ? ` (${health.updatedAge}s lalu)` : ""}`);
  if (health.lastLog) {
    console.log(`Last log: ${health.lastLog.text}`);
    if (health.lastLog.date) console.log(`Last log time: ${formatStateTime(health.lastLog.date.toISOString())}${health.lastLogAge !== null ? ` (${health.lastLogAge}s lalu)` : ""}`);
  } else {
    console.log("Last log: Log masih kosong");
  }
  if (health.health !== "OK") {
    console.log("");
    if (health.staleState) console.log("Saran: jalankan `sudo seotask service restart` atau `sudo seotask update --yes` setelah versi terbaru tersedia.");
    else if (health.staleTask || health.noActivity) console.log("Saran: cek `seotask log live`; jika tidak bergerak, jalankan `sudo seotask service restart`.");
    else console.log("Saran: cek `systemctl status seotask.service --no-pager`.");
  }
  return health.health === "OK" ? 0 : 2;
}

async function cmdUpdate(args) {
  if (!isRoot()) throw new CliError("Update butuh root. Jalankan dengan sudo.");
  const arch = detectReleaseArch();
  const assetName = `seotask-linux-${arch}`;
  const release = await fetchLatestRelease();
  const latestVersion = normalizeVersion(release.tag_name);
  if (compareVersions(CLI_VERSION, latestVersion) >= 0) {
    console.log(`SeoTask sudah versi terbaru: ${CLI_VERSION}`);
    return 0;
  }
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const asset = assets.find((item) => item && item.name === assetName && item.browser_download_url);
  if (!asset) throw new CliError(`Asset release tidak ditemukan: ${assetName}`);
  if (!fs.existsSync(INSTALL_PATH)) {
    throw new CliError(`Binary install tidak ditemukan di ${INSTALL_PATH}. Install manual terlebih dulu.`);
  }

  console.log(`Versi saat ini: ${CLI_VERSION}`);
  console.log(`Versi terbaru: ${release.tag_name}`);
  console.log(`Asset: ${assetName}`);
  if (!args.yes) {
    const answer = String(await prompt("Lanjut update? ketik UPDATE untuk melanjutkan: ")).trim();
    if (answer !== "UPDATE") {
      console.log("Update dibatalkan.");
      return 1;
    }
  }

  const activeBefore = ["active", "activating"].includes(serviceStatusValue("is-active"));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seotask-update-"));
  const downloaded = path.join(tempDir, assetName);
  const staged = `${INSTALL_PATH}.new`;
  try {
    await downloadFile(asset.browser_download_url, downloaded);
    fs.copyFileSync(downloaded, staged);
    fs.chmodSync(staged, 0o755);
    fs.renameSync(staged, INSTALL_PATH);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }

  if (activeBefore) {
    const restart = runSystemctl(["restart", SERVICE_NAME]);
    if (restart.status !== 0) throw new CliError((restart.stderr || "").trim() || "Binary terupdate, tapi service gagal restart.");
    console.log("Service direstart.");
  }
  console.log(`Update selesai: ${release.tag_name}`);
  return 0;
}

async function cmdEstimate(args) {
  const days = Number.parseInt(args.days, 10);
  if (!Number.isFinite(days) || days <= 0 || String(args.days).trim() !== String(days)) {
    throw new UsageError("argument days: harus berupa angka hari.");
  }
  if (days < 7) throw new CliError("Estimate minimal 7 hari.");

  const stats = earningStats(days);
  if (!stats.dataDays) {
    console.log("Belum ada data pendapatan.");
    console.log("Jalankan task terlebih dulu agar SeoTask bisa mencatat reward harian.");
    return 1;
  }

  const stable = roundRub(stats.avgDailyRub * days);
  const slow = roundRub(stable * 0.7);
  const high = roundRub(stable * 1.3);
  const first = stats.recent[0];
  const last = stats.recent[stats.recent.length - 1];

  console.log(`Estimate: ${days} hari`);
  console.log("");
  console.log("Data pendapatan:");
  console.log(`- Rentang data: ${first.date} sampai ${last.date}`);
  console.log(`- Data tersedia: ${stats.dataDays} hari`);
  console.log(`- Total tercatat: ${stats.totalRub} RUB dari ${stats.totalTasks} task`);
  console.log(`- Rata-rata harian: ${stats.avgDailyRub} RUB`);
  console.log(`- Rata-rata task harian: ${stats.avgDailyTasks} task`);
  console.log(`- Stabilitas: ${stats.stability}`);
  if (stats.dataDays < 7) {
    console.log("- Catatan data: data belum mencapai 7 hari, estimasi masih kasar.");
  }
  console.log("");
  console.log("Perkiraan pendapatan:");
  console.log(`- Slow: ${slow} RUB`);
  console.log(`- Stabil: ${stable} RUB`);
  console.log(`- Tinggi: ${high} RUB`);
  console.log("");
  console.log(`Jika task stabil selalu tersedia dan rate reward tetap stabil, estimasi ${days} hari sekitar ${stable} RUB.`);
  console.log(`Jika task slow, estimasi bisa turun ke sekitar ${slow} RUB.`);
  console.log(`Jika task dan rate tinggi, estimasi bisa naik ke sekitar ${high} RUB.`);
  return 0;
}

function removePath(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (error) {
    throw new CliError(`Gagal menghapus ${target}: ${error.message || error}`);
  }
}

async function cmdUninstall() {
  const installPath = "/usr/local/bin/seotask";
  const paths = [SERVICE_PATH, installPath, configDir()];
  console.log("PERINGATAN: uninstall akan menghapus SeoTask dari sistem ini.");
  console.log("Yang akan dihapus:");
  console.log(`- Service systemd: ${SERVICE_PATH}`);
  console.log(`- Binary: ${installPath}`);
  console.log(`- Config/session/credentials: ${configDir()}`);
  console.log("");
  console.log("Data login, session, credentials, dan state runner akan hilang.");
  const answer = String(await prompt("Ketik UNINSTALL untuk melanjutkan: ")).trim();
  if (answer !== "UNINSTALL") {
    console.log("Uninstall dibatalkan.");
    return 1;
  }
  if (!isRoot()) throw new CliError("Uninstall bersih butuh root. Jalankan dengan sudo.");

  runSystemctl(["disable", "--now", SERVICE_NAME]);
  for (const target of paths) removePath(target);
  runSystemctl(["daemon-reload"]);
  console.log("SeoTask berhasil dihapus dari sistem ini.");
  return 0;
}

function printRootHelp() {
  console.log(`usage: seotask [-h] {login,creds,credentials,fingerprint,telegram,status,start,stop,service,log,earnings,estimate,doctor,health,version,update,uninstall} ...

CLI ringkas SeoTask: login, creds, fingerprint, telegram, status, start, stop, service, log, earnings, estimate, doctor, health, version, update, uninstall.

positional arguments:
  {login,creds,credentials,fingerprint,telegram,status,start,stop,service,log,earnings,estimate,doctor,health,version,update,uninstall}
    login               Login akun menggunakan email/password atau cookie.
    creds (credentials)
                        Setup credentials untuk auto relogin (atau cek status
                        credentials).
    fingerprint         Kelola fingerprint Android unik per VPS.
    telegram            Kelola notifikasi earnings harian via Telegram.
    status              Cek status sesi, info akun, dan saldo RUB.
    start               Mulai runner headless: get_task -> countdown ->
                        complete_task.
    stop                Hentikan runner headless yang sedang berjalan.
    service             Kelola service systemd agar auto-start saat VPS
                        reboot.
    log                 Tampilkan log runner.
    earnings            Ringkasan pendapatan RUB yang sudah tercatat.
    estimate            Estimasi pendapatan RUB untuk beberapa hari ke depan.
    doctor              Cek kondisi binary, config, service, dan network.
    health              Cek kesehatan runner, stale state, dan log terakhir.
    version             Tampilkan versi SeoTask yang sedang dipakai.
    update              Update binary SeoTask dari GitHub Release terbaru.
    uninstall           Hapus SeoTask, service, dan semua config lokal.

options:
  -h, --help            show this help message and exit`);
}

function printVersionHelp() {
  console.log(`usage: seotask version [-h]

options:
  -h, --help  show this help message and exit`);
}

function printLoginHelp() {
  console.log(`usage: seotask login [-h] [--email EMAIL --password PASSWORD | --cookie COOKIE | --cookie-file FILE]

options:
  -h, --help              show this help message and exit
  --email EMAIL           Email akun SeoTask. Login akan meminta CAPTCHA jika
                          server menampilkannya.
  --password PASSWORD     Password akun SeoTask.
  --cookie COOKIE         Import cookie session dari WebView/browser.
  --cookie-file FILE      Import cookie dari file Netscape atau header Cookie.
  --domain DOMAIN         Domain cookie session. Default: seo-task.com
  --user-agent USER_AGENT Override User-Agent session.
  --x-requested-with X_REQUESTED_WITH
                          Override X-Requested-With session.
  --app-package APP_PACKAGE
                          Override app package session.
  --app-version APP_VERSION
                          Override X-App-Version session.
  --device-id DEVICE_ID   Override X-Device-Id session.
  --app-token APP_TOKEN   Override X-App-Token session.`);
}

function printCredsHelp() {
  console.log(`usage: seotask creds [-h] [{status}]

positional arguments:
  {status}    Gunakan \`status\` untuk melihat credentials tersimpan.

options:
  -h, --help  show this help message and exit`);
}

function printFingerprintHelp() {
  console.log(`usage: seotask fingerprint [-h] {init,show,presets,reset}
                         [--random] [--preset PRESET] [--device DEVICE]
                         [--force] [--yes]

positional arguments:
  {init,show,presets,reset}
              init: buat fingerprint unik per VPS.
              show: tampilkan fingerprint tersimpan.
              presets: tampilkan daftar preset.
              reset: hapus fingerprint tersimpan.

options:
  -h, --help       show this help message and exit
  --random         Pilih preset random dan buat device_id baru.
  --preset PRESET  Gunakan preset tertentu.
  --device DEVICE  Buat fingerprint dari nama device custom.
  --force          Izinkan init menimpa fingerprint lama.
  --yes            Simpan tanpa prompt konfirmasi.`);
}

function printTelegramHelp() {
  console.log(`usage: seotask telegram [-h] {setup,status,test,send,disable,enable}
                        [--bot-token BOT_TOKEN] [--chat-id CHAT_ID]
                        [--time HH:MM] [--timezone TIMEZONE] [--test]

positional arguments:
  {setup,status,test,send,disable,enable}
              setup: setup BOT_TOKEN, CHAT_ID, dan jadwal report.
              status: tampilkan status config dan scheduler.
              test: kirim pesan test Telegram.
              send: kirim laporan earnings harian sekarang.
              disable: nonaktifkan notifikasi dan scheduler.
              enable: aktifkan kembali notifikasi dan scheduler.

options:
  -h, --help             show this help message and exit
  --bot-token BOT_TOKEN  Token bot Telegram.
  --chat-id CHAT_ID      Chat ID tujuan.
  --time HH:MM           Jadwal harian. Default: 06:00
  --timezone TIMEZONE    Timezone jadwal. Default: Asia/Jakarta
  --test                 Kirim pesan test setelah setup.`);
}

function printStatusHelp() {
  console.log(`usage: seotask status [-h] [-v]

options:
  -h, --help     show this help message and exit
  -v, --verbose  Tampilkan detail header dan cuplikan halaman.`);
}

function printStartHelp() {
  console.log(`usage: seotask start [-h] [--max-tasks MAX_TASKS]
                     [--poll-interval POLL_INTERVAL]
                     [--post-task-delay POST_TASK_DELAY] [--timeout TIMEOUT]
                     [--skip-up-data] [--no-youtube-touch]
                     [--youtube-cookie-file YOUTUBE_COOKIE_FILE]
                     [--domain DOMAIN] [--user-agent USER_AGENT]
                     [--x-requested-with X_REQUESTED_WITH]
                     [--app-package APP_PACKAGE] [--app-version APP_VERSION]
                     [--device-id DEVICE_ID] [--app-token APP_TOKEN] [-v]

options:
  -h, --help            show this help message and exit
  --max-tasks MAX_TASKS
                        Batas jumlah task diproses. 0 = tanpa batas.
  --poll-interval POLL_INTERVAL
                        Jeda detik saat belum ada task. Default: 20
  --post-task-delay POST_TASK_DELAY
                        Jeda detik setelah complete_task. Default: 2
  --timeout TIMEOUT     Timeout request HTTP (detik). Default: 30
  --skip-up-data        Lewati request up_data sebelum get_task.
  --no-youtube-touch    Jangan touch URL YouTube di background.
  --youtube-cookie-file YOUTUBE_COOKIE_FILE
                        File cookie YouTube (opsional) untuk request touch
                        URL.
  --domain DOMAIN       Domain cookie session. Default: seo-task.com
  --user-agent USER_AGENT
                        Override User-Agent runtime.
  --x-requested-with X_REQUESTED_WITH
                        Override X-Requested-With runtime.
  --app-package APP_PACKAGE
                        Override app package runtime.
  --app-version APP_VERSION
                        Override X-App-Version runtime.
  --device-id DEVICE_ID
                        Override X-Device-Id runtime.
  --app-token APP_TOKEN
                        Override X-App-Token runtime.
  -v, --verbose         Tampilkan detail request/proses task.`);
}

function printStopHelp() {
  console.log(`usage: seotask stop [-h]

options:
  -h, --help  show this help message and exit`);
}

function printServiceHelp() {
  console.log(`usage: seotask service [-h] {install,start,stop,restart,status,uninstall}

positional arguments:
  {install,start,stop,restart,status,uninstall}
                        Aksi service.

options:
  -h, --help            show this help message and exit`);
}

function printLogHelp() {
  console.log(`usage: seotask log [-h] [{live,clear}]

positional arguments:
  {live,clear}
             live: tampilkan log live dengan countdown task aktif.
             clear: kosongkan file log lokal.

options:
  -h, --help  show this help message and exit`);
}

function printEarningsHelp() {
  console.log(`usage: seotask earnings [-h]

options:
  -h, --help  show this help message and exit`);
}

function printEstimateHelp() {
  console.log(`usage: seotask estimate [-h] DAYS

positional arguments:
  DAYS        Jumlah hari estimasi. Minimal 7.

options:
  -h, --help  show this help message and exit`);
}

function printDoctorHelp() {
  console.log(`usage: seotask doctor [-h]

options:
  -h, --help  show this help message and exit`);
}

function printHealthHelp() {
  console.log(`usage: seotask health [-h]

options:
  -h, --help  show this help message and exit`);
}

function printUpdateHelp() {
  console.log(`usage: seotask update [-h] [--yes]

options:
  -h, --help  show this help message and exit
  --yes       Jalankan update tanpa prompt konfirmasi.`);
}

function printUninstallHelp() {
  console.log(`usage: seotask uninstall [-h]

options:
  -h, --help  show this help message and exit`);
}

function parseOptions(argv, spec) {
  const result = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "-h" || token === "--help") {
      result.help = true;
      continue;
    }
    if (token === "-v" || token === "--verbose") {
      result.verbose = true;
      continue;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const name = eq > -1 ? token.slice(2, eq) : token.slice(2);
      const valueFromEq = eq > -1 ? token.slice(eq + 1) : null;
      const key = spec.names[name];
      if (!key) throw new UsageError(`unrecognized arguments: --${name}`);
      if (spec.flags.has(name)) {
        result[key] = true;
      } else {
        const value = valueFromEq !== null ? valueFromEq : argv[++i];
        if (value === undefined) throw new UsageError(`argument --${name}: expected one argument`);
        result[key] = value;
      }
      continue;
    }
    positional.push(token);
  }
  result._ = positional;
  return result;
}

function startSpec() {
  const names = {
    "max-tasks": "maxTasks",
    "poll-interval": "pollInterval",
    "post-task-delay": "postTaskDelay",
    timeout: "timeout",
    "skip-up-data": "skipUpData",
    "no-youtube-touch": "noYoutubeTouch",
    "youtube-cookie-file": "youtubeCookieFile",
    domain: "domain",
    "user-agent": "userAgent",
    "x-requested-with": "xRequestedWith",
    "app-package": "appPackage",
    "app-version": "appVersion",
    "device-id": "deviceId",
    "app-token": "appToken",
    "service-run": "serviceRun",
  };
  return { names, flags: new Set(["skip-up-data", "no-youtube-touch", "service-run"]) };
}

async function dispatch(argv) {
  const command = argv[0];
  if (!command || command === "-h" || command === "--help") {
    printRootHelp();
    return 0;
  }
  if (![
    "login",
    "creds",
    "credentials",
    "fingerprint",
    "telegram",
    "status",
    "start",
    "stop",
    "service",
    "log",
    "earnings",
    "estimate",
    "doctor",
    "health",
    "version",
    "update",
    "uninstall",
  ].includes(command)) {
    throw new UsageError(`argument command: invalid choice: '${command}'`);
  }
  const rest = argv.slice(1);
  if (command === "version") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printVersionHelp();
      return 0;
    }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    return cmdVersion();
  }
  if (command === "login") {
    const args = parseOptions(rest, {
      names: {
        email: "email",
        password: "password",
        cookie: "cookie",
        "cookie-file": "cookieFile",
        domain: "domain",
        "user-agent": "userAgent",
        "x-requested-with": "xRequestedWith",
        "app-package": "appPackage",
        "app-version": "appVersion",
        "device-id": "deviceId",
        "app-token": "appToken",
      },
      flags: new Set(),
    });
    if (args.help) {
      printLoginHelp();
      return 0;
    }
    if (!args.cookie && !args.cookieFile && ((args.email && !args.password) || (!args.email && args.password))) throw new UsageError("gunakan --email dan --password bersamaan, atau jalankan `seotask login` tanpa argumen untuk prompt interaktif");
    if ((args.cookie || args.cookieFile) && (args.email || args.password)) throw new UsageError("gunakan salah satu: --email/--password, prompt interaktif, atau --cookie/--cookie-file");
    if (args.cookie && args.cookieFile) throw new UsageError("gunakan salah satu: --cookie atau --cookie-file");
    return cmdLogin(args);
  }
  if (command === "creds" || command === "credentials") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printCredsHelp();
      return 0;
    }
    if (args._.length > 1 || (args._[0] && args._[0] !== "status")) throw new UsageError("argument action: invalid choice");
    args.action = args._[0] || null;
    return cmdCreds(args);
  }
  if (command === "fingerprint") {
    const args = parseOptions(rest, {
      names: {
        random: "random",
        preset: "preset",
        device: "device",
        force: "force",
        yes: "yes",
      },
      flags: new Set(["random", "force", "yes"]),
    });
    if (args.help) {
      printFingerprintHelp();
      return 0;
    }
    if (args._.length !== 1 || !["init", "show", "presets", "reset"].includes(args._[0])) {
      throw new UsageError("argument action: invalid choice");
    }
    args.action = args._[0];
    return cmdFingerprint(args);
  }
  if (command === "telegram") {
    const args = parseOptions(rest, {
      names: {
        "bot-token": "botToken",
        "chat-id": "chatId",
        time: "time",
        timezone: "timezone",
        test: "test",
      },
      flags: new Set(["test"]),
    });
    if (args.help) {
      printTelegramHelp();
      return 0;
    }
    if (args._.length !== 1 || !["setup", "status", "test", "send", "disable", "enable"].includes(args._[0])) {
      throw new UsageError("argument action: invalid choice");
    }
    args.action = args._[0];
    return cmdTelegram(args);
  }
  if (command === "status") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printStatusHelp();
      return 0;
    }
    return cmdStatus(args);
  }
  if (command === "start") {
    const args = parseOptions(rest, startSpec());
    if (args.help) {
      printStartHelp();
      return 0;
    }
    args.maxTasks = args.maxTasks === undefined ? 0 : args.maxTasks;
    args.pollInterval = args.pollInterval === undefined ? 20 : args.pollInterval;
    args.postTaskDelay = args.postTaskDelay === undefined ? 2 : args.postTaskDelay;
    args.timeout = args.timeout === undefined ? 30 : args.timeout;
    args.skipUpData = Boolean(args.skipUpData);
    args.noYoutubeTouch = Boolean(args.noYoutubeTouch);
    args.serviceRun = Boolean(args.serviceRun || process.env.SEOTASK_SERVICE);
    args.domain = args.domain || DEFAULT_COOKIE_DOMAIN;
    return cmdStart(args);
  }
  if (command === "stop") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printStopHelp();
      return 0;
    }
    return cmdStop(args);
  }
  if (command === "service") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printServiceHelp();
      return 0;
    }
    if (args._.length !== 1 || !["install", "start", "stop", "restart", "status", "uninstall"].includes(args._[0])) {
      throw new UsageError("argument action: invalid choice");
    }
    args.action = args._[0];
    return cmdService(args);
  }
  if (command === "log") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printLogHelp();
      return 0;
    }
    if (args._.length > 1 || (args._[0] && !["live", "clear"].includes(args._[0]))) throw new UsageError("argument action: invalid choice");
    args.action = args._[0] || null;
    return cmdLog(args);
  }
  if (command === "earnings") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printEarningsHelp();
      return 0;
    }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    return cmdEarnings();
  }
  if (command === "estimate") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printEstimateHelp();
      return 0;
    }
    if (args._.length !== 1) throw new UsageError("the following arguments are required: DAYS");
    args.days = args._[0];
    return cmdEstimate(args);
  }
  if (command === "doctor") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printDoctorHelp();
      return 0;
    }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    return cmdDoctor();
  }
  if (command === "health") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printHealthHelp();
      return 0;
    }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    return cmdHealth();
  }
  if (command === "update") {
    const args = parseOptions(rest, { names: { yes: "yes" }, flags: new Set(["yes"]) });
    if (args.help) {
      printUpdateHelp();
      return 0;
    }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    return cmdUpdate(args);
  }
  if (command === "uninstall") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) {
      printUninstallHelp();
      return 0;
    }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    return cmdUninstall();
  }
  return 1;
}

async function main() {
  try {
    const code = await dispatch(process.argv.slice(2));
    process.exitCode = Number.isInteger(code) ? code : 0;
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = error instanceof UsageError ? 2 : 1;
      return;
    }
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
