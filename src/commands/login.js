"use strict";

const fs = require("fs");
const path = require("path");
const { DEFAULT_COOKIE_DOMAIN } = require("../config/constants");
const { CliError } = require("../lib/errors");
const { expandHome, normalizeUserAgent } = require("../lib/utils");
const { loadSession } = require("../lib/session");
const { loadFingerprint } = require("../lib/fingerprint");
const { loadCredentials, prompt, runLoginWithCredentials } = require("../lib/auth");
const { saveSessionCookie } = require("../lib/session");

async function askUseSavedCredentials(creds) {
  console.log(`Email: ${creds.email}`);
  console.log(`Password: ${creds.password}`);
  while (true) {
    const answer = String(await prompt("Login sebagai user ini? (y/n): ")).trim().toLowerCase();
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    console.log("Input tidak valid. Jawab y atau n.");
  }
}

async function cmdLogin(args) {
  if (args.cookie || args.cookieFile) {
    const session = loadSession(false) || {};
    const fingerprint = loadFingerprint(false) || {};
    const targetDomain = args.domain || DEFAULT_COOKIE_DOMAIN;
    const userAgent = normalizeUserAgent(args.userAgent || fingerprint.user_agent || session.user_agent);
    const appPackage = require("../lib/utils").normalizeHeaderValue("App-Package", args.appPackage) || fingerprint.app_package || session.app_package || require("../config/constants").ANDROID_APP_PACKAGE;
    const appVersion = require("../lib/utils").normalizeHeaderValue("X-App-Version", args.appVersion) || fingerprint.app_version || session.app_version || require("../config/constants").ANDROID_APP_VERSION;
    const deviceId = require("../lib/utils").normalizeHeaderValue("X-Device-Id", args.deviceId) || fingerprint.device_id || session.device_id || require("../lib/utils").generateDeviceId();
    const appToken = require("../lib/utils").normalizeHeaderValue("X-App-Token", args.appToken) || fingerprint.app_token || session.app_token || require("../lib/utils").buildAppToken(deviceId, appPackage);
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

  let email = args.email;
  let password = args.password;
  if (email === undefined && password === undefined) {
    const creds = loadCredentials(false);
    if (creds && await askUseSavedCredentials(creds)) {
      email = creds.email;
      password = creds.password;
    }
  }
  if (email === undefined) email = await prompt("EMAIL: ");
  if (password === undefined) password = await prompt("PASSWORD: ");
  email = String(email).trim();
  password = String(password).trim();
  if (!email || !password) throw new CliError("Gunakan: seotask login --email 'email@mail.com' --password 'password'");
  return runLoginWithCredentials(args, email, password);
}

module.exports = { cmdLogin };
