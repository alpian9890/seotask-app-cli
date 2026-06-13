"use strict";

const { CliError } = require("./errors");
const {
  nowUtc,
  atomicWriteJson,
  readJson,
  gmailPath,
} = require("./utils");

function isValidEmail(email) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(email || "").trim());
}

function isGmail(email) {
  return /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());
}

function maskGoogleEmail(email) {
  const value = String(email || "").trim();
  if (!isValidEmail(value)) return "invalid_email";
  const [name, domain] = value.split("@");
  if (!name || !domain) return "invalid_email";
  if (name.length <= 2) return `***@${domain}`;
  return `${name.charAt(0)}***${name.charAt(name.length - 1)}@${domain}`;
}

function saveGoogleEmail(email) {
  email = String(email || "").trim().toLowerCase();
  if (!isGmail(email)) throw new CliError("google_email wajib alamat @gmail.com yang valid.");
  const previous = readJson(gmailPath()) || {};
  const data = {
    google_email: email,
    updated_at: nowUtc(),
  };
  data.created_at = previous.created_at || data.updated_at;
  atomicWriteJson(gmailPath(), data);
  return gmailPath();
}

function loadGoogleEmail(required = false) {
  const data = readJson(gmailPath());
  const email = String((data && data.google_email) || "").trim().toLowerCase();
  if (!email) {
    if (required) throw new CliError("google_email belum diset. Jalankan `seotask gmail` dulu.");
    return null;
  }
  if (!isGmail(email)) {
    if (required) throw new CliError("google_email tersimpan tidak valid. Jalankan `seotask gmail` ulang.");
    return null;
  }
  return email;
}

function sessionLoginEmail(session = null) {
  const currentSession = session || require("./session").loadSession(false) || {};
  const creds = require("./auth").loadCredentials(false);
  return String(currentSession.login_email || (creds && creds.email) || "").trim().toLowerCase();
}

function effectiveGoogleEmail(session = null) {
  const configured = loadGoogleEmail(false);
  if (configured) return { email: configured, source: "gmail" };
  const loginEmail = sessionLoginEmail(session);
  if (isGmail(loginEmail)) return { email: loginEmail, source: "login" };
  return { email: "", source: "none" };
}

module.exports = {
  isValidEmail,
  isGmail,
  maskGoogleEmail,
  saveGoogleEmail,
  loadGoogleEmail,
  sessionLoginEmail,
  effectiveGoogleEmail,
};
