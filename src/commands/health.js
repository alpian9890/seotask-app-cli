"use strict";

const { formatStateTime } = require("../lib/utils");
const { analyzeRunnerHealth } = require("../lib/telegram");
const { taskStatusLine } = require("../lib/runner");

async function cmdHealth() {
  const health = analyzeRunnerHealth();
  const state = health.state;
  console.log("SeoTask Health");
  console.log("");
  console.log(`Service: ${health.serviceActive}`);
  console.log(`Service enabled: ${health.serviceEnabled}`);
  console.log(`Runner: ${health.runner}`);
  console.log(`Health: ${health.health}`);
  console.log(`PID: ${health.pid || "-"}${health.pid ? ` (${health.pidAlive ? "alive" : "dead"})` : ""}`);
  console.log(taskStatusLine());
  if (state.last_status) console.log(`Last status: ${state.last_status}`);
  if (state.last_message) console.log(`Last message: ${state.last_message}`);
  if (state.updated_at) console.log(`State updated: ${formatStateTime(state.updated_at)}${health.updatedAge !== null ? ` (${health.updatedAge}s lalu)` : ""}`);
  if (health.lastLog) {
    console.log(`Last log: ${health.lastLog.text}`);
    if (health.lastLog.date) console.log(`Last log time: ${formatStateTime(health.lastLog.date.toISOString())}${health.lastLogAge !== null ? ` (${health.lastLogAge}s lalu)` : ""}`);
  } else {
    console.log("Last log: Log masih kosong");
  }
  if (health.health !== "OK") {
    console.log("");
    if (health.staleState) console.log("Saran: jalankan `sudo seotask service restart` atau `sudo seotask update --yes` setelah versi terbaru tersedia.");
    else if (health.staleTask || health.noActivity) console.log("Saran: cek `seotask log live`; jika tidak bergerak, jalankan `sudo seotask service restart`.");
    else console.log("Saran: cek `systemctl status seotask.service --no-pager`.");
  }
  return health.health === "OK" ? 0 : 2;
}

module.exports = { cmdHealth };