"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { CliError } = require("../lib/errors");
const { prompt } = require("../lib/auth");
const {
  CLI_VERSION,
  GITHUB_REPO,
  SERVICE_NAME,
  INSTALL_PATH,
} = require("../config/constants");
const {
  detectReleaseArch,
  isRoot,
  normalizeVersion,
  compareVersions,
  runSystemctl,
  serviceStatusValue,
} = require("../lib/utils");
const { httpRequest, downloadFile } = require("../lib/http");

async function fetchLatestRelease() {
  const response = await httpRequest(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    method: "GET",
    headers: {
      "User-Agent": `seotask/${CLI_VERSION}`,
      Accept: "application/vnd.github+json",
    },
    timeout: 30,
    retries: 2,
    maxBodyBytes: 1000000,
  });
  if (response.status >= 400) throw new CliError(`Gagal cek release GitHub (HTTP ${response.status}).`);
  let payload;
  try {
    payload = JSON.parse(response.body.toString("utf8"));
  } catch (error) {
    throw new CliError(`Respons release GitHub bukan JSON valid: ${error.message}`);
  }
  if (!payload || typeof payload !== "object" || !payload.tag_name) {
    throw new CliError("Respons release GitHub tidak memiliki tag release.");
  }
  return payload;
}

async function cmdUpdate(args) {
  if (!isRoot()) throw new CliError("Update butuh root. Jalankan dengan sudo.");
  const arch = detectReleaseArch();
  const assetName = `seotask-linux-${arch}`;
  const release = await fetchLatestRelease();
  const latestVersion = normalizeVersion(release.tag_name);
  if (compareVersions(CLI_VERSION, latestVersion) >= 0) {
    console.log(`SeoTask sudah versi terbaru: ${CLI_VERSION}`);
    return 0;
  }
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const asset = assets.find((item) => item && item.name === assetName && item.browser_download_url);
  if (!asset) throw new CliError(`Asset release tidak ditemukan: ${assetName}`);
  if (!fs.existsSync(INSTALL_PATH)) {
    throw new CliError(`Binary install tidak ditemukan di ${INSTALL_PATH}. Install manual terlebih dulu.`);
  }

  console.log(`Versi saat ini: ${CLI_VERSION}`);
  console.log(`Versi terbaru: ${release.tag_name}`);
  console.log(`Asset: ${assetName}`);
  if (!args.yes) {
    const answer = String(await prompt("Lanjut update? ketik UPDATE untuk melanjutkan: ")).trim();
    if (answer !== "UPDATE") {
      console.log("Update dibatalkan.");
      return 1;
    }
  }

  const activeBefore = ["active", "activating"].includes(serviceStatusValue("is-active"));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seotask-update-"));
  const downloaded = path.join(tempDir, assetName);
  const staged = `${INSTALL_PATH}.new`;
  try {
    await downloadFile(asset.browser_download_url, downloaded);
    fs.copyFileSync(downloaded, staged);
    fs.chmodSync(staged, 0o755);
    fs.renameSync(staged, INSTALL_PATH);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }

  if (activeBefore) {
    const restart = runSystemctl(["restart", SERVICE_NAME]);
    if (restart.status !== 0) throw new CliError((restart.stderr || "").trim() || "Binary terupdate, tapi service gagal restart.");
    console.log("Service direstart.");
  }
  console.log(`Update selesai: ${release.tag_name}`);
  return 0;
}

module.exports = { cmdUpdate };