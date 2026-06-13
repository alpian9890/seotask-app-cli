"use strict";

const { DEFAULT_UA } = require("../config/constants");
const { CliError } = require("../lib/errors");
const { normalizePlayerEngine, loadPlayerConfig } = require("./config");
const { TouchPlayer, NullPlayer } = require("./touch");
const { LightpandaPlayer } = require("./lightpanda");

function browserUserAgentFromProfile(profile = {}) {
  const value = String(profile.user_agent || DEFAULT_UA || "").trim();
  return value
    .replace(/\s*SeoTask-App\/1\.0\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

class UnimplementedPlayer {
  constructor(engine) {
    this.engine = engine;
  }

  async start() {
    throw new CliError(`Engine player '${this.engine}' belum diimplementasikan. Gunakan 'seotask player touch' untuk mode stabil saat ini.`);
  }
}

function createPlayer(options = {}) {
  const config = options.config || loadPlayerConfig();
  const engine = normalizePlayerEngine(options.engine || config.engine || "touch");
  if (engine === "none") return new NullPlayer();
  if (engine === "touch") {
    return new TouchPlayer({
      browserUserAgent: options.browserUserAgent || browserUserAgentFromProfile(options.profile || {}),
      youtubeCookie: options.youtubeCookie || "",
      timeout: options.timeout || config.timeout || 30,
    });
  }
  if (engine === "lightpanda") {
    return new LightpandaPlayer({
      browserUserAgent: options.browserUserAgent || browserUserAgentFromProfile(options.profile || {}),
      host: config.host || "127.0.0.1",
      port: config.port || 0,
      timeout: options.timeout || config.timeout || 30,
      cdpHost: config.cdp_host || "127.0.0.1",
      cdpPort: config.cdp_port || 0,
      userDataDir: config.user_data_dir || "",
    });
  }
  return new UnimplementedPlayer(engine);
}

module.exports = {
  browserUserAgentFromProfile,
  createPlayer,
};
