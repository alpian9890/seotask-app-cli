"use strict";

const {
  BASE_URL,
  DEFAULT_COOKIE_DOMAIN,
  ANDROID_APP_PACKAGE,
  ANDROID_APP_VERSION,
  DEFAULT_UA,
} = require("../config/constants");
const { CliError } = require("./errors");
const {
  nowUtc,
  atomicWriteJson,
  readJson,
  sessionPath,
  fingerprintPath,
  normalizeUserAgent,
  normalizeHeaderValue,
  generateDeviceId,
  buildAppToken,
  ensureSeoTaskUserAgent,
} = require("./utils");
const { parseCookieHeader, cookieDictToHeader } = require("./http");

// ─── Cookie parsing (Netscape & raw) ─────────────────────────────────────────
function normalizeCookie(cookie) {
  cookie = String(cookie || "").trim();
  if (cookie.toLowerCase().startsWith("cookie:")) cookie = cookie.split(/:(.*)/s)[1].trim();
  cookie = cookie.replace(/[\r\n]+/g, " ").trim();
  if (!cookie) throw new CliError("Cookie kosong.");
  if (!cookie.includes("=")) throw new CliError("Format cookie tidak valid. Contoh: PHPSESSID=...; other=value");
  return cookie;
}

function parseNetscapeCookies(text, targetDomain = DEFAULT_COOKIE_DOMAIN) {
  const { domainMatches } = require("./http");
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
  const fs = require("fs");
  const path = require("path");
  const { expandHome } = require("./utils");
  return parseCookieInput(fs.readFileSync(path.resolve(expandHome(file)), "utf8"), targetDomain);
}

// ─── Session management ──────────────────────────────────────────────────────
function loadSession(required = true) {
  const session = readJson(sessionPath());
  if (required && !session) {
    throw new CliError("Belum login. Jalankan `seotask login --email ... --password ...` atau import cookie dengan `seotask login --cookie ...`.");
  }
  if (session) {
    const fingerprint = readJson(fingerprintPath()) || {};
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

module.exports = {
  normalizeCookie,
  parseNetscapeCookies,
  looksLikeNetscapeCookie,
  parseCookieInput,
  readCookieFile,
  loadSession,
  saveSessionCookie,
};