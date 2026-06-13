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
  parseTelegramTopicLink,
  normalizeTelegramChatId,
  normalizeTelegramThreadId,
  telegramTargetConfigured,
  telegramTargetText,
  sendTelegramMessage,
  buildTelegramEarningsMessage,
  configureTelegramSchedule,
  disableTelegramSchedule,
  telegramScheduleStatus,
} = require("../lib/telegram");

function topicTargetFromLink(value) {
  const parsed = parseTelegramTopicLink(value);
  if (!parsed) throw new CliError("Link topic tidak valid. Contoh: https://t.me/c/4305132504/7");
  return { chatId: parsed.chat_id, threadId: String(parsed.thread_id) };
}

function topicTargetFromManual(chatId, threadId) {
  return {
    chatId: normalizeTelegramChatId(chatId),
    threadId: normalizeTelegramThreadId(threadId),
  };
}

async function promptTopicSetup(label, args, prefix) {
  if (args[`${prefix}Topic`]) return topicTargetFromLink(args[`${prefix}Topic`]);
  if (args[`${prefix}ChatId`] || args[`${prefix}ThreadId`]) {
    if (!args[`${prefix}ChatId`] || !args[`${prefix}ThreadId`]) {
      throw new CliError(`--${prefix === "login" ? "login" : "earnings"}-chat-id dan --${prefix === "login" ? "login" : "earnings"}-thread-id harus dipakai bersamaan.`);
    }
    return topicTargetFromManual(args[`${prefix}ChatId`], args[`${prefix}ThreadId`]);
  }
  while (true) {
    console.log(`Setup notifikasi ${label}:`);
    console.log("1. Paste link topic");
    console.log("2. Isi manual");
    console.log("0. Setup nanti");
    const choice = String(await prompt("Pilihan: ")).trim();
    if (choice === "0") return null;
    if (choice === "1") {
      const link = await prompt(`Paste link topic ${label}: `);
      return topicTargetFromLink(link);
    }
    if (choice === "2") {
      const chatId = await prompt(`CHAT_ID ${label}: `);
      const threadId = await prompt(`${label.toUpperCase()}_THREAD_ID: `);
      return topicTargetFromManual(chatId, threadId);
    }
    console.log("Input tidak valid. Pilih 1, 2, atau 0.");
  }
}

function applyTopicTarget(config, prefix, target) {
  if (!target) return;
  config.chat_id = config.chat_id || target.chatId;
  config[`${prefix}_chat_id`] = target.chatId;
  config[`${prefix}_thread_id`] = target.threadId;
}

async function cmdTelegram(args) {
  const action = args.action;
  if (action === "setup") {
    const botToken = String(args.botToken || await prompt("BOT_TOKEN: ")).trim();
    console.log("WARNING: Pastikan BOT telegram valid dan sudah ditambahkan ke dalam group");
    const config = {
      enabled: true,
      bot_token: botToken,
      chat_id: args.chatId ? normalizeTelegramChatId(args.chatId) : "",
      time: "06:00",
      timezone: "Asia/Jakarta",
      scheduler: "manual",
    };
    if (!botToken) throw new CliError("BOT_TOKEN wajib diisi.");
    const loginTarget = await promptTopicSetup("login", args, "login");
    applyTopicTarget(config, "login", loginTarget);
    const earningsTarget = await promptTopicSetup("earnings", args, "earnings");
    applyTopicTarget(config, "earnings", earningsTarget);
    if (!config.chat_id && !config.login_chat_id && !config.earnings_chat_id) {
      console.log("Target Telegram belum diset. Token tetap disimpan; jalankan `seotask telegram setup` ulang untuk menambahkan topic.");
    }
    const time = normalizeNotifyTime(args.time || await prompt("Jadwal notifikasi harian (HH:MM, default 06:00): ") || "06:00");
    const timezone = normalizeTimezone(args.timezone || await prompt("Timezone (default Asia/Jakarta): ") || "Asia/Jakarta");
    config.time = time;
    config.timezone = timezone;
    saveTelegramConfig(config);
    config.scheduler = telegramTargetConfigured(config, "earnings") ? configureTelegramSchedule(config) : "manual";
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
    console.log(`Login target: ${telegramTargetText(config, "login")}`);
    console.log(`Earnings target: ${telegramTargetText(config, "earnings")}`);
    console.log(`Jadwal: ${config.time || "06:00"} ${config.timezone || "Asia/Jakarta"}`);
    console.log(`Scheduler: ${telegramScheduleStatus()}`);
    console.log(`Last sent: ${config.last_sent_at || "-"}`);
    return 0;
  }
  if (action === "test") {
    const config = loadTelegramConfig(true);
    const sent = [];
    if (config.login_thread_id || config.login_chat_id) {
      await sendTelegramMessage(config, `Test Telegram SeoTask Login\n🖥️ ${os.hostname() || "-"}\nStatus: OK`, { topic: "login" });
      sent.push("login");
    }
    if (config.earnings_thread_id || config.earnings_chat_id) {
      await sendTelegramMessage(config, `Test Telegram SeoTask Earnings\n🖥️ ${os.hostname() || "-"}\nStatus: OK`, { topic: "earnings" });
      sent.push("earnings");
    }
    if (!sent.length) {
      const text = `Test Telegram SeoTask\n🖥️ ${os.hostname() || "-"}\nStatus: OK`;
      await sendTelegramMessage(config, text);
      sent.push("default");
    }
    console.log("Pesan test Telegram terkirim.");
    return 0;
  }
  if (action === "send") {
    const config = loadTelegramConfig(true);
    const text = await buildTelegramEarningsMessage(config);
    await sendTelegramMessage(config, text, { topic: "earnings" });
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
    config.scheduler = telegramTargetConfigured(config, "earnings") ? configureTelegramSchedule(config) : "manual";
    saveTelegramConfig(config);
    console.log(`Telegram notification diaktifkan. Scheduler: ${config.scheduler}`);
    if (config.scheduler === "manual") console.log("Jalankan manual: `seotask telegram send`.");
    return 0;
  }
  throw new UsageError("argument action: invalid choice");
}

module.exports = { cmdTelegram };
