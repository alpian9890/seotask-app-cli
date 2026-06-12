"use strict";

const os = require("os");
const { CliError, UsageError } = require("../lib/errors");
const { prompt } = require("../lib/auth");
const {
  maskSecret,
  normalizeNotifyTime,
  normalizeTimezone,
  nowUtc,
  previousDateKeyInTimezone,
} = require("../lib/utils");
const {
  loadTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  buildTelegramEarningsMessage,
  configureTelegramSchedule,
  disableTelegramSchedule,
  telegramScheduleStatus,
} = require("../lib/telegram");

async function cmdTelegram(args) {
  const action = args.action;
  if (action === "setup") {
    const botToken = String(args.botToken || await prompt("BOT_TOKEN: ")).trim();
    const chatId = String(args.chatId || await prompt("CHAT_ID: ")).trim();
    const time = normalizeNotifyTime(args.time || await prompt("Jadwal notifikasi harian (HH:MM, default 06:00): ") || "06:00");
    const timezone = normalizeTimezone(args.timezone || await prompt("Timezone (default Asia/Jakarta): ") || "Asia/Jakarta");
    if (!botToken || !chatId) throw new CliError("BOT_TOKEN dan CHAT_ID wajib diisi.");
    const config = {
      enabled: true,
      bot_token: botToken,
      chat_id: chatId,
      time,
      timezone,
      scheduler: "manual",
    };
    saveTelegramConfig(config);
    config.scheduler = configureTelegramSchedule(config);
    saveTelegramConfig(config);
    const { telegramPath } = require("../lib/utils");
    console.log(`Telegram config tersimpan: ${telegramPath()}`);
    console.log(`Scheduler: ${config.scheduler}`);
    if (config.scheduler === "manual") {
      console.log("Systemd timer/cron tidak tersedia atau tidak bisa dipasang. Jalankan manual: `seotask telegram send`.");
    }
    if (args.test) await cmdTelegram({ action: "test" });
    return 0;
  }
  if (action === "status") {
    const config = loadTelegramConfig(false);
    if (!config) {
      console.log("Telegram: belum diset.");
      console.log("Jalankan: seotask telegram setup");
      return 1;
    }
    console.log(`Enabled: ${Boolean(config.enabled)}`);
    console.log(`BOT_TOKEN: ${maskSecret(config.bot_token)}`);
    console.log(`CHAT_ID: ${config.chat_id || "-"}`);
    console.log(`Jadwal: ${config.time || "06:00"} ${config.timezone || "Asia/Jakarta"}`);
    console.log(`Scheduler: ${telegramScheduleStatus()}`);
    console.log(`Last sent: ${config.last_sent_at || "-"}`);
    return 0;
  }
  if (action === "test") {
    const config = loadTelegramConfig(true);
    const text = `Test Telegram SeoTask\n🖥️ ${os.hostname() || "-"}\nStatus: OK`;
    await sendTelegramMessage(config, text);
    console.log("Pesan test Telegram terkirim.");
    return 0;
  }
  if (action === "send") {
    const config = loadTelegramConfig(true);
    const text = await buildTelegramEarningsMessage(config);
    await sendTelegramMessage(config, text);
    saveTelegramConfig({ last_sent_at: nowUtc(), last_sent_date: previousDateKeyInTimezone(config.timezone || "Asia/Jakarta") });
    console.log("Laporan earnings Telegram terkirim.");
    return 0;
  }
  if (action === "disable") {
    const config = loadTelegramConfig(true);
    const scheduler = disableTelegramSchedule();
    saveTelegramConfig({ ...config, enabled: false, scheduler });
    console.log("Telegram notification dinonaktifkan.");
    return 0;
  }
  if (action === "enable") {
    const config = loadTelegramConfig(true);
    config.enabled = true;
    config.time = normalizeNotifyTime(config.time || "06:00");
    config.timezone = normalizeTimezone(config.timezone || "Asia/Jakarta");
    config.scheduler = configureTelegramSchedule(config);
    saveTelegramConfig(config);
    console.log(`Telegram notification diaktifkan. Scheduler: ${config.scheduler}`);
    if (config.scheduler === "manual") console.log("Jalankan manual: `seotask telegram send`.");
    return 0;
  }
  throw new UsageError("argument action: invalid choice");
}

module.exports = { cmdTelegram };