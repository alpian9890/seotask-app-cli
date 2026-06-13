"use strict";

const { CliError } = require("../lib/errors");
const { prompt } = require("../lib/auth");
const { isRoot, runSystemctl, removePath } = require("../lib/utils");
const { configDir } = require("../lib/utils");
const { SERVICE_NAME, SERVICE_PATH, INSTALL_PATH } = require("../config/constants");

async function cmdUninstall() {
  const installPath = "/usr/local/bin/seotask";
  const paths = [SERVICE_PATH, installPath, configDir()];
  console.log("PERINGATAN: uninstall akan menghapus SeoTask dari sistem ini.");
  console.log("Yang akan dihapus:");
  console.log(`- Service systemd: ${SERVICE_PATH}`);
  console.log(`- Binary: ${installPath}`);
  console.log(`- Config/session/credentials: ${configDir()}`);
  console.log("");
  console.log("Data login, session, credentials, dan state runner akan hilang.");
  const answer = String(await prompt("Ketik UNINSTALL untuk melanjutkan: ")).trim();
  if (answer !== "UNINSTALL") {
    console.log("Uninstall dibatalkan.");
    return 1;
  }
  if (!isRoot()) throw new CliError("Uninstall bersih butuh root. Jalankan dengan sudo.");

  runSystemctl(["disable", "--now", SERVICE_NAME]);
  for (const target of paths) removePath(target);
  runSystemctl(["daemon-reload"]);
  console.log("SeoTask berhasil dihapus dari sistem ini.");
  return 0;
}

module.exports = { cmdUninstall };