#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");
const buildDir = path.join(root, "build");
const releaseDir = path.join(root, "release");
const bundle = path.join(distDir, "seotask.bundle.js");
const obfuscated = path.join(distDir, "seotask.obf.js");
const defaultArch = process.arch === "arm64" ? "arm64" : "x64";
const target = process.env.PKG_TARGET || `node18-linux-${defaultArch}`;
const releaseTargets = [
  ["node18-linux-arm64", "seotask-linux-arm64"],
  ["node18-linux-x64", "seotask-linux-amd64"],
];

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function binPath(name) {
  const ext = process.platform === "win32" ? ".cmd" : "";
  return path.join(root, "node_modules", ".bin", name + ext);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function lightpandaKeyForTarget(targetName) {
  if (targetName.includes("linux-arm64")) return "linux-arm64";
  if (targetName.includes("linux-x64")) return "linux-x64";
  return null;
}

function lightpandaSourceForKey(key) {
  const envName = key === "linux-arm64" ? "LIGHTPANDA_BIN_ARM64" : "LIGHTPANDA_BIN_X64";
  if (process.env[envName]) return path.resolve(process.env[envName]);
  const currentKey = process.arch === "arm64" ? "linux-arm64" : "linux-x64";
  if (key === currentKey) return path.join(os.homedir(), ".cache", "lightpanda-node", "lightpanda");
  return "";
}

function prepareLightpandaAssets(targetNames) {
  if (process.env.BUNDLE_LIGHTPANDA !== "1") return;
  const keys = Array.from(new Set(targetNames.map(lightpandaKeyForTarget).filter(Boolean)));
  for (const key of keys) {
    const source = lightpandaSourceForKey(key);
    if (!source || !fs.existsSync(source)) {
      console.error(`Error: binary Lightpanda untuk ${key} tidak ditemukan.`);
      console.error("Set LIGHTPANDA_BIN_X64 atau LIGHTPANDA_BIN_ARM64, atau install @lightpanda/browser pada arsitektur yang sama.");
      process.exit(1);
    }
    const destDir = path.join(distDir, "assets", "lightpanda", key);
    const dest = path.join(destDir, "lightpanda");
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(source, dest);
    fs.chmodSync(dest, 0o700);
    console.log(`Lightpanda asset: dist/assets/lightpanda/${key}/lightpanda`);
  }
}

// Bersihkan dist folder dulu sebelum copy ulang
try { fs.rmSync(distDir, { recursive: true, force: true }); } catch (_) {}

fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

// Copy seluruh struktur src/ ke dist/ agar pkg bisa resolve semua require('./lib/...')
copyDir(srcDir, distDir);
prepareLightpandaAssets(process.env.BUILD_RELEASE === "1" ? releaseTargets.map((item) => item[0]) : [target]);
const entryPoint = path.join(distDir, "seotask.js");
fs.chmodSync(entryPoint, 0o755);
// Buat bundle (symlink entry point)
fs.copyFileSync(entryPoint, bundle);
fs.chmodSync(bundle, 0o755);

const obfuscator = binPath("javascript-obfuscator");
if (fs.existsSync(obfuscator)) {
  run(obfuscator, [
    bundle,
    "--output",
    obfuscated,
    "--compact",
    "true",
    "--control-flow-flattening",
    "true",
    "--dead-code-injection",
    "true",
    "--identifier-names-generator",
    "hexadecimal",
    "--string-array",
    "true",
    "--string-array-encoding",
    "base64",
    "--string-array-threshold",
    "0.85",
    "--ignore-imports",
    "true",
  ]);
} else {
  fs.copyFileSync(bundle, obfuscated);
}
fs.chmodSync(obfuscated, 0o755);

const pkg = binPath("pkg");
if (!fs.existsSync(pkg)) {
  console.error("Error: pkg binary tidak ditemukan. Jalankan `npm install` lebih dulu.");
  process.exit(1);
}

if (process.env.BUILD_RELEASE === "1") {
  for (const [releaseTarget, fileName] of releaseTargets) {
    const output = path.join(releaseDir, fileName);
    run(pkg, [obfuscated, "--config", path.join(root, "package.json"), "--targets", releaseTarget, "--output", output]);
    fs.chmodSync(output, 0o755);
    console.log(`Binary dibuat: release/${fileName}`);
  }
} else {
  const output = path.join(buildDir, "seotask");
  run(pkg, [obfuscated, "--config", path.join(root, "package.json"), "--targets", target, "--output", output]);
  fs.chmodSync(output, 0o755);
  console.log("Binary dibuat: build/seotask");
}
