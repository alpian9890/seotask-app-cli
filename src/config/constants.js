"use strict";

// ─── Aplikasi ────────────────────────────────────────────────────────────────
const APP_NAME = "seotask-cli";
const CLI_VERSION = "1.0.10";
const GITHUB_REPO = "alpian9890/seotask-app-cli";

// ─── URL & Domain ────────────────────────────────────────────────────────────
const BASE_URL = "https://seo-task.com";
const WEBAPP_URL = `${BASE_URL}/webphone/`;
const DEFAULT_COOKIE_DOMAIN = "seo-task.com";

// ─── Service Systemd ─────────────────────────────────────────────────────────
const SERVICE_NAME = "seotask.service";
const SERVICE_PATH = "/etc/systemd/system/seotask.service";
const TELEGRAM_SERVICE_NAME = "seotask-telegram.service";
const TELEGRAM_TIMER_NAME = "seotask-telegram.timer";
const TELEGRAM_SERVICE_PATH = `/etc/systemd/system/${TELEGRAM_SERVICE_NAME}`;
const TELEGRAM_TIMER_PATH = `/etc/systemd/system/${TELEGRAM_TIMER_NAME}`;
const INSTALL_PATH = "/usr/local/bin/seotask";

// ─── Android App Identity ────────────────────────────────────────────────────
const ANDROID_APP_PACKAGE = "com.example.videoload";
const ANDROID_APP_VERSION = "1.3.3";
const ANDROID_TOKEN_SALT = "seo_task_ge6fdgvskt";

// ─── HTTP ────────────────────────────────────────────────────────────────────
const HTTP_RETRY_ATTEMPTS = 3;
const HTTP_RETRY_BASE_DELAY = 1200;

// ─── Log & Runner ────────────────────────────────────────────────────────────
const MAX_LOG_LINES = 200;
const STALE_TASK_GRACE_SECONDS = 120;
const NO_ACTIVITY_SECONDS = 600;

// ─── Default User-Agent ──────────────────────────────────────────────────────
const DEFAULT_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 " +
  "SeoTask-App/1.0";

// ─── Fingerprint Presets ─────────────────────────────────────────────────────
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

module.exports = {
  APP_NAME,
  CLI_VERSION,
  GITHUB_REPO,
  BASE_URL,
  WEBAPP_URL,
  DEFAULT_COOKIE_DOMAIN,
  SERVICE_NAME,
  SERVICE_PATH,
  TELEGRAM_SERVICE_NAME,
  TELEGRAM_TIMER_NAME,
  TELEGRAM_SERVICE_PATH,
  TELEGRAM_TIMER_PATH,
  INSTALL_PATH,
  ANDROID_APP_PACKAGE,
  ANDROID_APP_VERSION,
  ANDROID_TOKEN_SALT,
  HTTP_RETRY_ATTEMPTS,
  HTTP_RETRY_BASE_DELAY,
  MAX_LOG_LINES,
  STALE_TASK_GRACE_SECONDS,
  NO_ACTIVITY_SECONDS,
  DEFAULT_UA,
  FINGERPRINT_PRESETS,
};
