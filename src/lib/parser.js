"use strict";

const { UsageError } = require("./errors");

function parseOptions(argv, spec) {
  const result = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "-h" || token === "--help") {
      result.help = true;
      continue;
    }
    if (token === "-v" || token === "--verbose") {
      result.verbose = true;
      continue;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const name = eq > -1 ? token.slice(2, eq) : token.slice(2);
      const valueFromEq = eq > -1 ? token.slice(eq + 1) : null;
      const key = spec.names[name];
      if (!key) throw new UsageError(`unrecognized arguments: --${name}`);
      if (spec.flags.has(name)) {
        result[key] = true;
      } else {
        const value = valueFromEq !== null ? valueFromEq : argv[++i];
        if (value === undefined) throw new UsageError(`argument --${name}: expected one argument`);
        result[key] = value;
      }
      continue;
    }
    positional.push(token);
  }
  result._ = positional;
  return result;
}

function startSpec() {
  const names = {
    "max-tasks": "maxTasks",
    "poll-interval": "pollInterval",
    "post-task-delay": "postTaskDelay",
    timeout: "timeout",
    "skip-up-data": "skipUpData",
    "no-youtube-touch": "noYoutubeTouch",
    "youtube-cookie-file": "youtubeCookieFile",
    domain: "domain",
    "user-agent": "userAgent",
    "x-requested-with": "xRequestedWith",
    "app-package": "appPackage",
    "app-version": "appVersion",
    "device-id": "deviceId",
    "app-token": "appToken",
    "service-run": "serviceRun",
  };
  return { names, flags: new Set(["skip-up-data", "no-youtube-touch", "service-run"]) };
}

module.exports = { parseOptions, startSpec };