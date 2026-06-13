"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const {
  BASE_URL,
  WEBAPP_URL,
  DEFAULT_COOKIE_DOMAIN,
  ANDROID_APP_PACKAGE,
  ANDROID_APP_VERSION,
  SERVICE_NAME,
  SERVICE_PATH,
} = require("../config/constants");
const { CliError } = require("./errors");
const {
  sleep,
  nowUtc,
  nowLocal,
  nowLogPrefix,
  readJson,
  atomicWriteJson,
  statePath,
  logPath,
  appendLogLine,
  processAlive,
  dateAgeSeconds,
  formatStateTime,
  normalizeUserAgent,
  normalizeHeaderValue,
  generateDeviceId,
  buildAppToken,
  isTransientRunnerError,
  alternateDeviceId,
  runSystemctl,
  serviceStatusValue,
  isRoot,
} = require("./utils");
const {
  parseCookieHeader,
  cookieDictToHeader,
  updateCookieStoreFromSetCookie,
  getSetCookieArray,
  httpRequest,
} = require("./http");
const { loadSession, saveSessionCookie, readCookieFile } = require("./session");
const { loadFingerprint } = require("./fingerprint");
const { loadCredentials, runLoginWithCredentials } = require("./auth");
const { effectiveGoogleEmail, isValidEmail, maskGoogleEmail } = require("./gmail");
const { recordEarning } = require("./earnings");
const { sendReloginTelegramNotification } = require("./telegram");
const { loadPlayerConfig } = require("../player/config");
const { createPlayer } = require("../player");

// ─── State helpers ───────────────────────────────────────────────────────────
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

function runnerIsActive(options = {}) {
  const state = readJson(statePath()) || {};
  if (!state.running) return false;
  if (state.pid && Number.parseInt(state.pid, 10) !== process.pid && !processAlive(state.pid)) {
    if (options.recover) recoverStaleRunnerState(`Stale state dibersihkan, PID lama ${state.pid} sudah mati.`, options.log !== false);
    return false;
  }
  return true;
}

function updateRunnerState(patch) {
  const state = readJson(statePath()) || {};
  Object.assign(state, patch, { updated_at: nowUtc() });
  atomicWriteJson(statePath(), state);
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

function taskStatusLine() {
  const { analyzeRunnerHealth } = require("./telegram");
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

// ─── Runtime profile resolver ────────────────────────────────────────────────
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
  const googleEmail = effectiveGoogleEmail(session);
  return {
    user_agent: userAgent,
    x_requested_with: xRequestedWith,
    app_package: appPackage,
    app_version: appVersion,
    device_id: deviceId,
    app_token: appToken,
    google_email: googleEmail.email,
    google_email_source: googleEmail.source,
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

// ─── JSON helpers for runner ─────────────────────────────────────────────────
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
  if (profile.google_email && isValidEmail(profile.google_email)) {
    deviceJson.google_email = maskGoogleEmail(profile.google_email);
  }
  return JSON.stringify(deviceJson);
}

// ─── Webapp helpers for runner ───────────────────────────────────────────────
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
  const { extractLoginHash } = require("./auth");
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

// ─── YouTube touch ───────────────────────────────────────────────────────────
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

// ─── Countdown helpers ───────────────────────────────────────────────────────
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

// ─── cmdStart ────────────────────────────────────────────────────────────────
async function cmdStart(args) {
  if (!args.serviceRun && fs.existsSync(SERVICE_PATH)) {
    const active = serviceStatusValue("is-active");
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
  const playerConfig = { ...loadPlayerConfig() };
  if (args.noYoutubeTouch) playerConfig.engine = "none";
  const player = createPlayer({ config: playerConfig, profile, youtubeCookie, timeout });
  state.player_engine = player.engine;
  atomicWriteJson(statePath(), state);
  const { logEvent } = require("./utils");
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
    await player.start();
    logEvent(`[PLAYER] engine=${player.engine}`);
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
      const { looksLoggedIn } = require("./auth");
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
          email: profile.google_email || "",
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
        try {
          await player.clear({
            status: "WAIT",
            message: mess,
            reason: mess,
            reward: currentState.last_reward || "",
            balance: currentState.last_balance || "",
          });
        } catch (error) {
          logEvent(`[PLAYER/WARN] Gagal clear player: ${error.message || error}`);
        }
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
      const taskStartedAt = nowUtc();
      updateRunnerState({
        last_status: "TASK",
        last_message: `video=${videoId} | timer=${timer}s | id_status=${idStatus}`,
        current_task_running: true,
        current_task_started_at: taskStartedAt,
        current_task_video_id: videoId,
        current_task_id_status: idStatus,
        current_task_timer: timer,
        current_task_url: taskUrl,
        player_engine: player.engine,
      });
      logEvent(`[TASK] video=${videoId} | timer=${timer}s | id_status=${idStatus}`);
      if (args.verbose) logEvent(`[URL] ${taskUrl}`);
      const playResult = await player.play(taskUrl, {
        status: "TASK",
        message: `video=${videoId} | timer=${timer}s | id_status=${idStatus}`,
        idStatus,
        videoId,
        timer,
        startedAt: taskStartedAt,
        reward: "",
        balance: (readJson(statePath()) || {}).last_balance || "",
      });
      if (args.verbose) {
        const status = playResult && Object.prototype.hasOwnProperty.call(playResult, "status")
          ? playResult.status
          : "ok";
        logEvent(`[PLAYER] engine=${player.engine} status=${status === null ? "gagal" : status}`);
        if (playResult && playResult.playerUrl) logEvent(`[PLAYER] url=${playResult.playerUrl}`);
        if (playResult && playResult.cdpUrl) logEvent(`[DEVTOOLS] ${playResult.cdpUrl}`);
        if (playResult && playResult.error) logEvent(`[PLAYER/WARN] ${playResult.error}`);
      }
      const finished = await countdownTask(timer, { idStatus, videoId });
      if (!finished) {
        const ignorePayload = { ajax_func: "ignor_task", id_status: String(idStatus), hash_ajax: hashAjax };
        const [, ignoreResult] = await postWebappJson("ajax/ajax_views.php", ignorePayload, profile, cookieStore, { timeout });
        logEvent(`[STOP] Task diabaikan: ${ignoreResult.mess || ignoreResult.status}`);
        updateRunnerState({ current_task_running: false, current_task_stopped_at: nowUtc() });
        try {
          await player.clear({ status: "WAIT", message: "Task stopped", reason: "Stop diminta" });
        } catch (_) {}
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
      try {
        await player.update({
          status: Boolean(completeResult.status) ? "DONE" : "WARN",
          message: currentState.last_message,
          reward: completeResult.price || 0,
          balance: completeResult.balance || "?",
        });
      } catch (error) {
        logEvent(`[PLAYER/WARN] Gagal update player: ${error.message || error}`);
      }
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
    try {
      await player.stop();
    } catch (error) {
      const { logEvent } = require("./utils");
      logEvent(`[PLAYER/WARN] Gagal stop player: ${error.message || error}`);
    }
    saveCookieStoreToSession(cookieStore, profile, domain);
    const finalState = readJson(statePath()) || {};
    Object.assign(finalState, { running: false, stopped_at: nowUtc(), processed_tasks: processed, current_task_running: false });
    atomicWriteJson(statePath(), finalState);
  }
  return 0;
}

// ─── cmdStop ─────────────────────────────────────────────────────────────────
async function cmdStop() {
  const state = readJson(statePath()) || {};
  const wasRunning = Boolean(state.running);
  Object.assign(state, { running: false, stopped_at: nowUtc(), current_task_running: false, last_status: "STOP", last_message: "Stop diminta" });
  atomicWriteJson(statePath(), state);
  const { appendLogLine } = require("./utils");
  appendLogLine(`${nowLogPrefix()} ${wasRunning ? "Runner headless: STOP diminta" : "Runner tidak aktif, state diset STOP."}`);
  if (fs.existsSync(SERVICE_PATH)) {
    console.log("Runner diminta berhenti. Service tetap terpasang; gunakan `seotask start` untuk menjalankan lagi sebagai service.");
    console.log("Untuk menghentikan unit systemd sepenuhnya, gunakan `sudo seotask service stop`.");
  }
  return 0;
}

module.exports = {
  recoverStaleRunnerState,
  runnerIsActive,
  updateRunnerState,
  currentCountdownText,
  taskStatusLine,
  resolveRuntimeProfile,
  parseJsonObject,
  buildHeadlessDeviceJson,
  fetchWebappHash,
  postWebappJson,
  saveCookieStoreToSession,
  touchYoutubeUrl,
  countdownUntilDone,
  countdownTask,
  waitWithStop,
  registerRunnerSignalHandlers,
  cmdStart,
  cmdStop,
};
