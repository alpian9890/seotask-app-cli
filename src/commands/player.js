"use strict";

const { DEFAULT_UA } = require("../config/constants");
const { CliError, UsageError } = require("../lib/errors");
const { fileStatus, playerPath } = require("../lib/utils");
const { loadFingerprint } = require("../lib/fingerprint");
const { readCookieFile } = require("../lib/session");
const { loadPlayerConfig, normalizePlayerEngine, savePlayerConfig } = require("../player/config");
const { browserUserAgentFromProfile, createPlayer } = require("../player");
const { extractYouTubeVideoId, toEmbedUrl } = require("../player/youtube");
const { lightpandaRuntimeDir } = require("../player/lightpanda");

function playerProfile() {
  const fingerprint = loadFingerprint(false) || {};
  return { user_agent: fingerprint.user_agent || DEFAULT_UA };
}

function normalizePort(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError("PORT player tidak valid.");
  return port;
}

function normalizeTimeout(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const timeout = Number.parseInt(value, 10);
  if (!Number.isInteger(timeout) || timeout < 5) throw new CliError("Timeout player minimal 5 detik.");
  return timeout;
}

function configPatchFromArgs(args) {
  const patch = {};
  if (args.host) patch.host = String(args.host).trim();
  const port = normalizePort(args.port);
  if (port !== undefined) patch.port = port;
  const timeout = normalizeTimeout(args.timeout);
  if (timeout !== undefined) patch.timeout = timeout;
  if (args.browserPath) patch.browser_path = String(args.browserPath).trim();
  if (args.cdpHost) patch.cdp_host = String(args.cdpHost).trim();
  const cdpPort = normalizePort(args.cdpPort);
  if (cdpPort !== undefined) patch.cdp_port = cdpPort;
  if (args.userDataDir) patch.user_data_dir = String(args.userDataDir).trim();
  return patch;
}

function printPlayerConfig(config) {
  const profile = playerProfile();
  console.log(`Engine: ${config.engine}`);
  console.log(`Config: ${playerPath()} (${fileStatus(playerPath())})`);
  console.log(`Host: ${config.host || "127.0.0.1"}`);
  console.log(`Port: ${config.port === undefined ? 0 : config.port}`);
  console.log(`Timeout: ${config.timeout || 30}s`);
  if (config.browser_path) console.log(`Browser path: ${config.browser_path}`);
  if (config.cdp_host || config.cdp_port) console.log(`CDP: ${config.cdp_host || "127.0.0.1"}:${config.cdp_port || 9222}`);
  if (config.user_data_dir) console.log(`User data dir: ${config.user_data_dir}`);
  console.log(`Lightpanda runtime: ${lightpandaRuntimeDir()}`);
  console.log(`Server UA: ${profile.user_agent}`);
  console.log(`Browser UA: ${browserUserAgentFromProfile(profile)}`);
}

async function runPlayerTest(args) {
  const url = String(args.url || "").trim();
  if (!url) throw new UsageError("the following arguments are required: URL");
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) throw new CliError("URL YouTube tidak valid.");
  const config = { ...loadPlayerConfig(), ...configPatchFromArgs(args) };
  const engine = normalizePlayerEngine(args.engine || config.engine || "touch");
  let youtubeCookie = "";
  if (args.cookieFile) youtubeCookie = readCookieFile(args.cookieFile, "youtube.com");
  const profile = playerProfile();
  const player = createPlayer({
    config: { ...config, engine },
    profile,
    youtubeCookie,
    timeout: config.timeout || 30,
  });
  await player.start();
  try {
    const result = await player.play(url, {
      status: "TASK",
      message: "Player test",
      idStatus: "test",
      videoId,
      timer: Number.parseInt(args.timer || 30, 10) || 30,
      startedAt: new Date().toISOString(),
    });
    console.log(`Engine: ${engine}`);
    console.log(`Video ID: ${videoId}`);
    console.log(`Embed URL: ${toEmbedUrl(url)}`);
    console.log(`Browser UA: ${browserUserAgentFromProfile(profile)}`);
    if (result && Object.prototype.hasOwnProperty.call(result, "status")) {
      console.log(`Result: ${result.status === null ? "gagal" : result.status}`);
    }
    if (result && result.error) console.log(`Error detail: ${result.error}`);
  } finally {
    await player.stop();
  }
}

async function cmdPlayer(args) {
  const action = args.action || "touch";
  if (action === "status") {
    printPlayerConfig(loadPlayerConfig());
    return 0;
  }
  if (action === "test") {
    await runPlayerTest(args);
    return 0;
  }
  const engine = normalizePlayerEngine(action);
  if (!["touch", "chromium", "lightpanda", "none"].includes(engine)) {
    throw new UsageError("argument action: invalid choice");
  }
  const saved = savePlayerConfig({ ...configPatchFromArgs(args), engine });
  console.log(`Player engine aktif: ${saved.engine}`);
  console.log(`Config tersimpan: ${playerPath()}`);
  if (saved.engine === "chromium" || saved.engine === "lightpanda") {
    console.log(`Catatan: engine ${saved.engine} masih tahap eksperimen sampai playback YouTube tervalidasi.`);
  }
  printPlayerConfig(saved);
  return 0;
}

module.exports = { cmdPlayer };
