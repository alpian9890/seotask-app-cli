#!/usr/bin/env node
"use strict";

const { CliError, UsageError } = require("./lib/errors");
const { parseOptions, startSpec } = require("./lib/parser");
const {
  printRootHelp,
  printVersionHelp,
  printLoginHelp,
  printCredsHelp,
  printGmailHelp,
  printFingerprintHelp,
  printTelegramHelp,
  printPlayerHelp,
  printDevtoolsHelp,
  printStatusHelp,
  printStartHelp,
  printStopHelp,
  printServiceHelp,
  printLogHelp,
  printEarningsHelp,
  printEstimateHelp,
  printDoctorHelp,
  printHealthHelp,
  printUpdateHelp,
  printUninstallHelp,
} = require("./help");

const VALID_COMMANDS = new Set([
  "login",
  "creds",
  "credentials",
  "gmail",
  "fingerprint",
  "telegram",
  "player",
  "devtools",
  "status",
  "start",
  "stop",
  "service",
  "log",
  "earnings",
  "estimate",
  "doctor",
  "health",
  "version",
  "update",
  "uninstall",
]);

async function dispatch(argv) {
  const command = argv[0];
  if (!command || command === "-h" || command === "--help") {
    printRootHelp();
    return 0;
  }
  if (!VALID_COMMANDS.has(command)) {
    throw new UsageError(`argument command: invalid choice: '${command}'`);
  }
  const rest = argv.slice(1);
  if (command === "version") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printVersionHelp(); return 0; }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    const { cmdVersion } = require("./commands/version");
    return cmdVersion();
  }
  if (command === "login") {
    const args = parseOptions(rest, {
      names: {
        email: "email", password: "password", cookie: "cookie",
        "cookie-file": "cookieFile", domain: "domain",
        "user-agent": "userAgent", "x-requested-with": "xRequestedWith",
        "app-package": "appPackage", "app-version": "appVersion",
        "device-id": "deviceId", "app-token": "appToken",
      },
      flags: new Set(),
    });
    if (args.help) { printLoginHelp(); return 0; }
    if (!args.cookie && !args.cookieFile && ((args.email && !args.password) || (!args.email && args.password)))
      throw new UsageError("gunakan --email dan --password bersamaan, atau jalankan `seotask login` tanpa argumen untuk prompt interaktif");
    if ((args.cookie || args.cookieFile) && (args.email || args.password))
      throw new UsageError("gunakan salah satu: --email/--password, prompt interaktif, atau --cookie/--cookie-file");
    if (args.cookie && args.cookieFile) throw new UsageError("gunakan salah satu: --cookie atau --cookie-file");
    const { cmdLogin } = require("./commands/login");
    return cmdLogin(args);
  }
  if (command === "creds" || command === "credentials") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printCredsHelp(); return 0; }
    if (args._.length > 1 || (args._[0] && args._[0] !== "status")) throw new UsageError("argument action: invalid choice");
    args.action = args._[0] || null;
    const { cmdCreds } = require("./commands/creds");
    return cmdCreds(args);
  }
  if (command === "gmail") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printGmailHelp(); return 0; }
    if (args._.length > 1 || (args._[0] && args._[0] !== "status")) throw new UsageError("argument action: invalid choice");
    args.action = args._[0] || null;
    const { cmdGmail } = require("./commands/gmail");
    return cmdGmail(args);
  }
  if (command === "fingerprint") {
    const args = parseOptions(rest, {
      names: { random: "random", preset: "preset", device: "device", force: "force", yes: "yes" },
      flags: new Set(["random", "force", "yes"]),
    });
    if (args.help) { printFingerprintHelp(); return 0; }
    if (args._.length !== 1 || !["init", "show", "presets", "reset"].includes(args._[0]))
      throw new UsageError("argument action: invalid choice");
    args.action = args._[0];
    const { cmdFingerprint } = require("./commands/fingerprint");
    return cmdFingerprint(args);
  }
  if (command === "telegram") {
    const args = parseOptions(rest, {
      names: {
        "bot-token": "botToken",
        "chat-id": "chatId",
        "login-topic": "loginTopic",
        "login-chat-id": "loginChatId",
        "login-thread-id": "loginThreadId",
        "earnings-topic": "earningsTopic",
        "earnings-chat-id": "earningsChatId",
        "earnings-thread-id": "earningsThreadId",
        time: "time",
        timezone: "timezone",
        test: "test",
      },
      flags: new Set(["test"]),
    });
    if (args.help) { printTelegramHelp(); return 0; }
    if (args._.length !== 1 || !["setup", "status", "test", "send", "disable", "enable"].includes(args._[0]))
      throw new UsageError("argument action: invalid choice");
    args.action = args._[0];
    const { cmdTelegram } = require("./commands/telegram");
    return cmdTelegram(args);
  }
  if (command === "player") {
    const args = parseOptions(rest, {
      names: {
        engine: "engine",
        host: "host",
        port: "port",
        timeout: "timeout",
        "browser-path": "browserPath",
        "cdp-host": "cdpHost",
        "cdp-port": "cdpPort",
        "user-data-dir": "userDataDir",
        "cookie-file": "cookieFile",
        timer: "timer",
      },
      flags: new Set(),
    });
    if (args.help) { printPlayerHelp(); return 0; }
    const action = args._[0] || "touch";
    if (!["touch", "chromium", "lightpanda", "none", "status", "test"].includes(action))
      throw new UsageError("argument action: invalid choice");
    if (action === "test") {
      if (args._.length !== 2) throw new UsageError("usage: seotask player test URL");
      args.url = args._[1];
    } else if (args._.length > 1) {
      throw new UsageError("unrecognized arguments: " + args._.slice(1).join(" "));
    }
    args.action = action;
    const { cmdPlayer } = require("./commands/player");
    return cmdPlayer(args);
  }
  if (command === "devtools") {
    const args = parseOptions(rest, {
      names: {
        port: "port",
        host: "host",
        bind: "bind",
      },
      flags: new Set(),
    });
    if (args.help) { printDevtoolsHelp(); return 0; }
    if (args._.length !== 1 || !["status", "off", "local", "public", "frontend", "url"].includes(args._[0]))
      throw new UsageError("argument action: invalid choice");
    args.action = args._[0];
    const { cmdDevtools } = require("./commands/devtools");
    return cmdDevtools(args);
  }
  if (command === "status") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printStatusHelp(); return 0; }
    const { cmdStatus } = require("./commands/status");
    return cmdStatus(args);
  }
  if (command === "start") {
    const args = parseOptions(rest, startSpec());
    if (args.help) { printStartHelp(); return 0; }
    args.maxTasks = args.maxTasks === undefined ? 0 : args.maxTasks;
    args.pollInterval = args.pollInterval === undefined ? 20 : args.pollInterval;
    args.postTaskDelay = args.postTaskDelay === undefined ? 2 : args.postTaskDelay;
    args.timeout = args.timeout === undefined ? 30 : args.timeout;
    args.skipUpData = Boolean(args.skipUpData);
    args.noYoutubeTouch = Boolean(args.noYoutubeTouch);
    args.serviceRun = Boolean(args.serviceRun || process.env.SEOTASK_SERVICE);
    args.domain = args.domain || require("./config/constants").DEFAULT_COOKIE_DOMAIN;
    const { cmdStart } = require("./commands/start");
    return cmdStart(args);
  }
  if (command === "stop") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printStopHelp(); return 0; }
    const { cmdStop } = require("./commands/stop");
    return cmdStop(args);
  }
  if (command === "service") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printServiceHelp(); return 0; }
    if (args._.length !== 1 || !["install", "start", "stop", "restart", "status", "uninstall"].includes(args._[0]))
      throw new UsageError("argument action: invalid choice");
    args.action = args._[0];
    const { cmdService } = require("./commands/service");
    return cmdService(args);
  }
  if (command === "log") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printLogHelp(); return 0; }
    if (args._.length > 1 || (args._[0] && !["live", "clear"].includes(args._[0])))
      throw new UsageError("argument action: invalid choice");
    args.action = args._[0] || null;
    const { cmdLog } = require("./commands/log");
    return cmdLog(args);
  }
  if (command === "earnings") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printEarningsHelp(); return 0; }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    const { cmdEarnings } = require("./commands/earnings");
    return cmdEarnings();
  }
  if (command === "estimate") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printEstimateHelp(); return 0; }
    if (args._.length !== 1) throw new UsageError("the following arguments are required: DAYS");
    args.days = args._[0];
    const { cmdEstimate } = require("./commands/estimate");
    return cmdEstimate(args);
  }
  if (command === "doctor") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printDoctorHelp(); return 0; }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    const { cmdDoctor } = require("./commands/doctor");
    return cmdDoctor();
  }
  if (command === "health") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printHealthHelp(); return 0; }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    const { cmdHealth } = require("./commands/health");
    return cmdHealth();
  }
  if (command === "update") {
    const args = parseOptions(rest, { names: { yes: "yes" }, flags: new Set(["yes"]) });
    if (args.help) { printUpdateHelp(); return 0; }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    const { cmdUpdate } = require("./commands/update");
    return cmdUpdate(args);
  }
  if (command === "uninstall") {
    const args = parseOptions(rest, { names: {}, flags: new Set() });
    if (args.help) { printUninstallHelp(); return 0; }
    if (args._.length) throw new UsageError("unrecognized arguments: " + args._.join(" "));
    const { cmdUninstall } = require("./commands/uninstall");
    return cmdUninstall();
  }
  return 1;
}

async function main() {
  try {
    const code = await dispatch(process.argv.slice(2));
    process.exitCode = Number.isInteger(code) ? code : 0;
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = error instanceof UsageError ? 2 : 1;
      return;
    }
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
