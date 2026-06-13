"use strict";

const crypto = require("crypto");
const fs = require("fs");

const {
  DEFAULT_UA,
  ANDROID_APP_PACKAGE,
  ANDROID_APP_VERSION,
  FINGERPRINT_PRESETS,
} = require("../config/constants");
const { CliError, UsageError } = require("./errors");
const {
  nowUtc,
  atomicWriteJson,
  readJson,
  fingerprintPath,
  ensureSeoTaskUserAgent,
  normalizeUserAgent,
  generateDeviceId,
  buildAppToken,
  cloneJson,
} = require("./utils");

// ─── Preset helpers ──────────────────────────────────────────────────────────
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

// ─── Build fingerprint ───────────────────────────────────────────────────────
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

// ─── Save / Load fingerprint ─────────────────────────────────────────────────
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

// ─── Print helper ────────────────────────────────────────────────────────────
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

module.exports = {
  fingerprintPresetNames,
  normalizePresetName,
  randomPresetName,
  titleFromSlug,
  customDevicePreset,
  buildFingerprint,
  saveFingerprint,
  loadFingerprint,
  printFingerprint,
};