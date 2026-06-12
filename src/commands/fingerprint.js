"use strict";

const fs = require("fs");
const { CliError, UsageError } = require("../lib/errors");
const { fingerprintPath, atomicWriteJson } = require("../lib/utils");
const { prompt } = require("../lib/auth");
const {
  fingerprintPresetNames,
  buildFingerprint,
  saveFingerprint,
  loadFingerprint,
  printFingerprint,
} = require("../lib/fingerprint");
const { FINGERPRINT_PRESETS } = require("../config/constants");

async function confirmFingerprint(fingerprint, canRegenerate = true) {
  if (!process.stdin.isTTY && !fs.existsSync("/dev/tty")) return "yes";
  printFingerprint(fingerprint);
  console.log("");
  const suffix = canRegenerate ? "[Y/n/r]" : "[Y/n]";
  const answer = String(await prompt(`Gunakan fingerprint ini? ${suffix} `)).trim().toLowerCase();
  if (!answer || answer === "y" || answer === "yes") return "yes";
  if (canRegenerate && (answer === "r" || answer === "regen" || answer === "random")) return "regenerate";
  return "no";
}

async function cmdFingerprint(args) {
  const action = args.action;
  if (action === "presets") {
    console.log("Preset fingerprint tersedia:");
    for (const name of fingerprintPresetNames()) {
      console.log(`- ${name}: ${FINGERPRINT_PRESETS[name].label}`);
    }
    return 0;
  }
  if (action === "show") {
    const fingerprint = loadFingerprint(true);
    console.log(`Fingerprint file: ${fingerprintPath()}`);
    console.log("");
    printFingerprint(fingerprint);
    return 0;
  }
  if (action === "reset") {
    if (!args.yes) {
      console.log(`Fingerprint yang akan dihapus: ${fingerprintPath()}`);
      const answer = String(await prompt("Ketik RESET untuk menghapus fingerprint: ")).trim();
      if (answer !== "RESET") {
        console.log("Reset fingerprint dibatalkan.");
        return 1;
      }
    }
    try {
      fs.unlinkSync(fingerprintPath());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    console.log("Fingerprint dihapus.");
    return 0;
  }
  if (action !== "init") throw new UsageError("argument action: invalid choice");

  const selected = [args.random ? "random" : null, args.preset ? "preset" : null, args.device ? "device" : null].filter(Boolean);
  if (selected.length > 1) throw new UsageError("gunakan salah satu: --random, --preset, atau --device");
  const existing = loadFingerprint(false);
  if (existing && !args.force) {
    console.log("Fingerprint sudah ada:");
    printFingerprint(existing);
    console.log("");
    console.log("Gunakan `seotask fingerprint init --force` jika ingin membuat ulang.");
    return 0;
  }

  while (true) {
    const fingerprint = buildFingerprint({
      preset: args.preset,
      device: args.device,
      allowCustom: true,
    });
    console.log("Fingerprint baru:");
    console.log("");
    if (args.yes) {
      printFingerprint(fingerprint);
      const saved = saveFingerprint(fingerprint);
      console.log("");
      console.log(`Fingerprint tersimpan: ${saved}`);
      return 0;
    }
    const decision = await confirmFingerprint(fingerprint, true);
    if (decision === "yes") {
      const saved = saveFingerprint(fingerprint);
      console.log(`Fingerprint tersimpan: ${saved}`);
      return 0;
    }
    if (decision === "regenerate") {
      console.log("");
      continue;
    }
    console.log("Setup fingerprint dibatalkan.");
    return 1;
  }
}

module.exports = { cmdFingerprint };