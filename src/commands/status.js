"use strict";

const { DEFAULT_COOKIE_DOMAIN } = require("../config/constants");
const {
  normalizeUserAgent,
  normalizeHeaderValue,
  stripHtmlText,
  pageTitle,
} = require("../lib/utils");
const { loadSession, saveSessionCookie } = require("../lib/session");
const { loadFingerprint } = require("../lib/fingerprint");
const { parseCookieHeader, cookieDictToHeader, makeRequest } = require("../lib/http");
const { looksLoggedIn, extractAccountInfo } = require("../lib/auth");
const { taskStatusLine } = require("../lib/runner");

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
  const { buildAppToken } = require("../lib/utils");
  const { ANDROID_APP_PACKAGE } = require("../config/constants");
  let appToken = normalizeHeaderValue("X-App-Token", args.appToken || fingerprint.app_token || session.app_token);
  if (deviceId && appPackage && !appToken) appToken = buildAppToken(deviceId, appPackage);
  const cookieStore = parseCookieHeader(String(session.cookie || ""));
  const cookieBefore = cookieDictToHeader(cookieStore);
  const { WEBAPP_URL } = require("../config/constants");
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

module.exports = { cmdStatus };