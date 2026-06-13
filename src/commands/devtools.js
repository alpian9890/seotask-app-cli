"use strict";

const { CliError, UsageError } = require("../lib/errors");
const { devtoolsPath } = require("../lib/utils");
const {
  loadDevtoolsConfig,
  normalizePort,
  saveDevtoolsConfig,
  devtoolsFrontendUrls,
} = require("../lib/devtools");

function printDevtoolsConfig(config) {
  console.log(`Mode: ${config.mode}`);
  console.log(`Port: ${config.port}`);
  console.log(`Bind: ${config.bind}`);
  console.log(`Public host: ${config.public_host}`);
  console.log(`Config: ${devtoolsPath()}`);
  if (config.mode === "local") {
    console.log(`Akses: gunakan SSH port forwarding, contoh \`ssh -L ${config.port}:127.0.0.1:${config.port} node2\` lalu buka http://127.0.0.1:${config.port}`);
  } else if (config.mode === "public") {
    console.log(`Akses: http://${config.public_host}:${config.port}`);
  } else if (config.mode === "frontend") {
    console.log("Akses: jalankan `seotask devtools url` setelah runner/player aktif untuk melihat URL chrome-devtools-frontend.");
  }
}

async function cmdDevtools(args) {
  const action = args.action || "status";
  if (action === "status") {
    printDevtoolsConfig(loadDevtoolsConfig());
    return 0;
  }
  if (action === "off") {
    const config = saveDevtoolsConfig({ ...loadDevtoolsConfig(), mode: "off", bind: "127.0.0.1", public_host: "127.0.0.1" });
    console.log("DevTools dinonaktifkan untuk start berikutnya.");
    printDevtoolsConfig(config);
    return 0;
  }
  if (action === "local" || action === "public" || action === "frontend") {
    const current = loadDevtoolsConfig();
    const port = normalizePort(args.port, current.port);
    const bind = args.bind || (action === "local" ? "127.0.0.1" : "0.0.0.0");
    let publicHost = args.host || (action === "local" ? "127.0.0.1" : current.public_host);
    if (action !== "local" && (!publicHost || publicHost === "127.0.0.1")) {
      const { publicIpAddress } = require("../lib/auth");
      publicHost = await publicIpAddress();
    }
    const config = saveDevtoolsConfig({ mode: action, port, bind, public_host: publicHost });
    console.log(`DevTools mode ${action} disimpan untuk start berikutnya.`);
    printDevtoolsConfig(config);
    if (action !== "local") console.log("PERINGATAN: membuka CDP ke publik berisiko. Gunakan hanya untuk testing singkat dan batasi firewall jika bisa.");
    return 0;
  }
  if (action === "url") {
    const config = loadDevtoolsConfig();
    if (config.mode === "off") throw new CliError("DevTools sedang off. Jalankan `seotask devtools local` atau `seotask devtools public` dulu.");
    const urls = await devtoolsFrontendUrls(config);
    if (!urls.length) {
      console.log(`Tidak ada page DevTools aktif di http://127.0.0.1:${config.port}. Pastikan runner/player sedang berjalan.`);
      return 1;
    }
    for (const item of urls) {
      console.log(`Title: ${item.title}`);
      if (item.page_url) console.log(`Page: ${item.page_url}`);
      console.log(`Frontend: ${item.url}`);
      console.log("");
    }
    return 0;
  }
  throw new UsageError("argument action: invalid choice");
}

module.exports = { cmdDevtools };
