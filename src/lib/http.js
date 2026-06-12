"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const {
  CLI_VERSION,
  BASE_URL,
  DEFAULT_COOKIE_DOMAIN,
  DEFAULT_UA,
  HTTP_RETRY_ATTEMPTS,
  HTTP_RETRY_BASE_DELAY,
} = require("../config/constants");
const {
  sleep,
  sanitizeUrlForError,
  isRetryableHttpStatus,
  isRetryableNetworkError,
  normalizeUserAgent,
} = require("./utils");

// ─── Cookie helpers ──────────────────────────────────────────────────────────
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

function domainMatches(cookieDomain, targetDomain) {
  cookieDomain = String(cookieDomain || "").trim().toLowerCase();
  targetDomain = String(targetDomain || "").trim().toLowerCase().replace(/^\./, "");
  if (cookieDomain.startsWith("#httponly_")) cookieDomain = cookieDomain.slice("#httponly_".length);
  cookieDomain = cookieDomain.replace(/^\./, "");
  return cookieDomain === targetDomain || cookieDomain.endsWith(`.${targetDomain}`);
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

function getSetCookieArray(headers) {
  const raw = headers && headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ─── HTTP request core ───────────────────────────────────────────────────────
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
      throw new Error(`Gagal konek ke ${safeUrl}: ${error.message || error}`);
    }
  }
  if (options.ipv4Fallback && !options.family) {
    return httpRequest(url, { ...options, family: 4, ipv4Fallback: false });
  }
  throw new Error(`Gagal konek ke ${safeUrl}: retry habis.`);
}

// ─── makeRequest helper ──────────────────────────────────────────────────────
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

// ─── Download file ───────────────────────────────────────────────────────────
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
          reject(new Error(`Download gagal (HTTP ${res.statusCode || 0}).`));
          return;
        }
        const file = fs.createWriteStream(outputPath, { mode: 0o755 });
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", (error) => reject(new Error(`Download gagal: ${error.message || error}`)));
    req.end();
  });
}

module.exports = {
  parseCookieHeader,
  cookieDictToHeader,
  parseSetCookie,
  domainMatches,
  updateCookieStoreFromSetCookie,
  getSetCookieArray,
  httpRequestOnce,
  httpRequest,
  makeRequest,
  downloadFile,
};