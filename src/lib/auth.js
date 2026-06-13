"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL, URLSearchParams } = require("url");
const { spawnSync } = require("child_process");

const {
  BASE_URL,
  WEBAPP_URL,
  DEFAULT_COOKIE_DOMAIN,
  ANDROID_APP_PACKAGE,
  ANDROID_APP_VERSION,
} = require("../config/constants");
const { CliError } = require("./errors");
const {
  nowUtc,
  atomicWriteJson,
  readJson,
  credentialsPath,
  configDir,
  ensureConfigDir,
  normalizeUserAgent,
  normalizeHeaderValue,
  generateDeviceId,
  buildAppToken,
  htmlEscape,
  stripHtmlText,
  formatHumanDate,
  normalizeTimezone,
} = require("./utils");
const { parseCookieHeader, cookieDictToHeader, updateCookieStoreFromSetCookie, getSetCookieArray, httpRequest, makeRequest, downloadFile } = require("./http");
const { saveSessionCookie, loadSession } = require("./session");
const { loadFingerprint } = require("./fingerprint");
const { loadTelegramConfig, sendTelegramPhoto } = require("./telegram");

// ─── Credentials ─────────────────────────────────────────────────────────────
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

// ─── HTML extraction helpers ─────────────────────────────────────────────────
function getHtmlAttribute(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag || "").match(new RegExp(`${escaped}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? htmlUnescape(match[2]) : "";
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

function extractErrorMessage(scriptBody) {
  const match = String(scriptBody || "").match(/error_load\\\('((?:\\'|[^'])*)'\\\)/);
  if (!match) return null;
  return match[1].replace(/\\'/g, "'").trim() || null;
}

// ─── CAPTCHA helpers ─────────────────────────────────────────────────────────
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
  const readline = require("readline");
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

function prompt(question) {
  const readline = require("readline");
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

async function publicIpAddress() {
  try {
    const response = await httpRequest("https://api.ipify.org?format=json", {
      method: "GET",
      headers: { "User-Agent": `seotask/${require("../config/constants").CLI_VERSION}` },
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

// ─── Login flow ──────────────────────────────────────────────────────────────
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
    const sessionPath = require("./utils").sessionPath();
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

module.exports = {
  saveCredentials,
  loadCredentials,
  getHtmlAttribute,
  looksLoggedIn,
  extractLoginHash,
  extractAccountInfo,
  extractLoginCaptcha,
  extractErrorMessage,
  saveCaptchaAssets,
  displayCaptchaImageIfPossible,
  promptCaptchaSelection,
  prompt,
  sendCaptchaPreviewToTelegram,
  publicIpAddress,
  runLoginWithCredentials,
};