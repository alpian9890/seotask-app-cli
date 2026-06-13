"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  APP_NAME,
  MAX_LOG_LINES,
  DEFAULT_UA,
  ANDROID_APP_PACKAGE,
  ANDROID_APP_VERSION,
  ANDROID_TOKEN_SALT,
} = require("../config/constants");

// ─── Sleep ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Date / Time ─────────────────────────────────────────────────────────────
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

function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatStateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateAgeSeconds(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

// ─── Path & Config Dir ───────────────────────────────────────────────────────
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

function gmailPath() {
  return path.join(configDir(), "gmail.json");
}

function playerPath() {
  return path.join(configDir(), "player.json");
}

function devtoolsPath() {
  return path.join(configDir(), "devtools.json");
}

function binaryPath() {
  return process.pkg ? process.execPath : path.resolve(process.argv[1] || process.execPath);
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

// ─── JSON helpers ────────────────────────────────────────────────────────────
function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortJsonValue(value[key]);
    return result;
  }, {});
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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new Error(`File config rusak: ${file}: ${error.message}`);
    throw error;
  }
}

// ─── Logging ─────────────────────────────────────────────────────────────────
function logEvent(message) {
  const line = `${nowLogPrefix()} ${message}`;
  console.log(line);
  appendLogLine(line);
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

// ─── Process helpers ─────────────────────────────────────────────────────────
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

function detectReleaseArch() {
  if (process.arch === "x64") return "amd64";
  if (process.arch === "arm64") return "arm64";
  throw new Error(`Arsitektur tidak didukung untuk update: ${process.arch}`);
}

function releaseArchText() {
  try {
    return detectReleaseArch();
  } catch (_) {
    return process.arch;
  }
}

function isRoot() {
  return typeof process.getuid === "function" ? process.getuid() === 0 : false;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────
function htmlEscape(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function normalizeHeaderValue(name, value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/[\r\n]+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.includes(":") && String(name).toLowerCase().startsWith("x-")) {
    throw new Error(`Nilai header ${name} tidak valid.`);
  }
  return normalized;
}

function normalizeUserAgent(userAgent) {
  let candidate = String(userAgent || "").trim();
  if (!candidate) candidate = DEFAULT_UA;
  candidate = candidate.replace(/[\r\n]+/g, " ").trim();
  if (!candidate) throw new Error("User-Agent kosong.");
  return candidate;
}

function ensureSeoTaskUserAgent(userAgent) {
  const value = normalizeUserAgent(userAgent);
  return value.includes("SeoTask-App/1.0") ? value : `${value} SeoTask-App/1.0`;
}

function parseRub(value) {
  const normalized = String(value ?? "0").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundRub(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function maskSecret(value) {
  const text = String(value || "");
  if (text.length <= 8) return text ? "********" : "-";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
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

function normalizeNotifyTime(value) {
  const text = String(value || "06:00").trim();
  const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error("Format jadwal harus HH:MM, contoh: 06:00");
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeTimezone(value) {
  const timezone = String(value || "Asia/Jakarta").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch (_) {
    throw new Error(`Timezone tidak valid: ${timezone}`);
  }
  return timezone;
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

function stripHtmlText(body) {
  let text = String(body || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, " ");
  text = text.replace(/<[^>]+>/g, " ");
  return htmlUnescape(text.replace(/\s+/g, " ")).trim();
}

function pageTitle(body) {
  const match = String(body || "").match(/<title[^>]*>(.*?)<\/title>/is);
  if (!match) return "(tanpa title)";
  return htmlUnescape(match[1].replace(/\s+/g, " ").trim()) || "(tanpa title)";
}

function sanitizeUrlForError(url) {
  return String(url || "").replace(/\/bot[0-9]+:[^/]+/g, "/bot<REDACTED>");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// ─── Crypto helpers ──────────────────────────────────────────────────────────
function generateDeviceId() {
  return `pro_${crypto.randomBytes(32).toString("hex").slice(0, 16)}`;
}

function buildAppToken(deviceId, appPackage) {
  return crypto.createHash("sha256").update(`${deviceId}:${appPackage}:${ANDROID_TOKEN_SALT}`, "utf8").digest("hex");
}

// ─── System helpers ──────────────────────────────────────────────────────────
function commandExists(command) {
  const result = spawnSync("sh", ["-c", `command -v ${command}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return result.status === 0;
}

function systemdAvailable() {
  return commandExists("systemctl") && fs.existsSync("/run/systemd/system");
}

function runSystemctl(args) {
  return spawnSync("systemctl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function removePath(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (error) {
    throw new Error(`Gagal menghapus ${target}: ${error.message || error}`);
  }
}

// ─── Network helpers ─────────────────────────────────────────────────────────
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

function alternateDeviceId(deviceId) {
  const value = String(deviceId || "").trim();
  if (value.startsWith("pro_") && value.length > 4) return `secure_${value.slice(4)}`;
  if (value.startsWith("secure_") && value.length > 7) return `pro_${value.slice(7)}`;
  return null;
}

function serviceStatusValue(action) {
  const result = runSystemctl([action, "seotask.service"]);
  if (result.error) return "tidak tersedia";
  const text = (result.stdout || result.stderr || "").trim();
  if (!text) return "unknown";
  if (text.includes("System has not been booted with systemd")) return "tidak tersedia";
  return text.split(/\r?\n/)[0] || "unknown";
}

module.exports = {
  sleep,
  nowUtc,
  nowLocal,
  nowLogPrefix,
  localDateKey,
  formatStateTime,
  dateAgeSeconds,
  expandHome,
  configDir,
  sessionPath,
  statePath,
  logPath,
  earningsPath,
  fingerprintPath,
  telegramPath,
  credentialsPath,
  gmailPath,
  playerPath,
  devtoolsPath,
  binaryPath,
  fileStatus,
  canWriteDir,
  ensureConfigDir,
  sortJsonValue,
  atomicWriteJson,
  readJson,
  logEvent,
  appendLogLine,
  readLogLines,
  parseLogDate,
  stripLogTimestamp,
  lastRelevantLogLine,
  processAlive,
  detectReleaseArch,
  releaseArchText,
  isRoot,
  htmlEscape,
  htmlUnescape,
  normalizeHeaderValue,
  normalizeUserAgent,
  ensureSeoTaskUserAgent,
  parseRub,
  roundRub,
  maskSecret,
  normalizeVersion,
  compareVersions,
  normalizeNotifyTime,
  normalizeTimezone,
  datePartsInTimezone,
  formatHumanDate,
  previousDateKeyInTimezone,
  formatDateKeyId,
  formatDateKeyHuman,
  stripHtmlText,
  pageTitle,
  sanitizeUrlForError,
  cloneJson,
  generateDeviceId,
  buildAppToken,
  commandExists,
  systemdAvailable,
  runSystemctl,
  removePath,
  isRetryableHttpStatus,
  isRetryableNetworkError,
  isTransientRunnerError,
  alternateDeviceId,
  serviceStatusValue,
};
