"use strict";

const { CliError } = require("../lib/errors");
const { atomicWriteJson, nowUtc, playerPath, readJson } = require("../lib/utils");

const VALID_PLAYER_ENGINES = new Set(["touch", "chromium", "lightpanda", "none"]);

function normalizePlayerEngine(value) {
  const engine = String(value || "touch").trim().toLowerCase();
  if (!VALID_PLAYER_ENGINES.has(engine)) {
    throw new CliError("Engine player tidak valid. Gunakan: touch, chromium, lightpanda, atau none.");
  }
  return engine;
}

function defaultPlayerConfig() {
  return {
    engine: "touch",
    host: "127.0.0.1",
    port: 0,
    timeout: 30,
  };
}

function loadPlayerConfig() {
  const data = readJson(playerPath());
  if (!data) return defaultPlayerConfig();
  return {
    ...defaultPlayerConfig(),
    ...data,
    engine: normalizePlayerEngine(data.engine || "touch"),
  };
}

function savePlayerConfig(data) {
  const previous = loadPlayerConfig();
  const saved = {
    ...previous,
    ...data,
    engine: normalizePlayerEngine(data.engine || previous.engine || "touch"),
    updated_at: nowUtc(),
  };
  if (!saved.created_at) saved.created_at = nowUtc();
  atomicWriteJson(playerPath(), saved);
  return saved;
}

module.exports = {
  VALID_PLAYER_ENGINES,
  normalizePlayerEngine,
  defaultPlayerConfig,
  loadPlayerConfig,
  savePlayerConfig,
};
