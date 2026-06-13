"use strict";

const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { PlayerServer } = require("./player-server");
const { CliError } = require("../lib/errors");
const { configDir } = require("../lib/utils");
const { DevtoolsProxy, resolveStartDevtoolsOptions } = require("../lib/devtools");

function platformKey() {
  if (process.platform !== "linux") throw new CliError("Lightpanda bundled saat ini hanya didukung di Linux.");
  if (process.arch === "x64") return "linux-x64";
  if (process.arch === "arm64") return "linux-arm64";
  throw new CliError(`Arsitektur Lightpanda belum didukung: ${process.arch}`);
}

function lightpandaRuntimeDir() {
  return path.join(configDir(), "engines", "lightpanda", platformKey());
}

function bundledLightpandaPath() {
  return path.resolve(__dirname, "..", "assets", "lightpanda", platformKey(), "lightpanda");
}

function homeCacheLightpandaPath() {
  return path.join(os.homedir(), ".cache", "lightpanda-node", "lightpanda");
}

function executableExists(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK | fs.constants.X_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function extractBundledLightpanda(source) {
  const dir = lightpandaRuntimeDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dest = path.join(dir, "lightpanda");
  let shouldCopy = true;
  try {
    const srcStat = fs.statSync(source);
    const dstStat = fs.statSync(dest);
    shouldCopy = srcStat.size !== dstStat.size;
  } catch (_) {}
  if (shouldCopy) fs.copyFileSync(source, dest);
  fs.chmodSync(dest, 0o700);
  return dest;
}

function resolveLightpandaExecutable() {
  const fromEnv = String(process.env.LIGHTPANDA_EXECUTABLE_PATH || "").trim();
  if (fromEnv) {
    if (!executableExists(fromEnv)) throw new CliError(`LIGHTPANDA_EXECUTABLE_PATH tidak bisa dieksekusi: ${fromEnv}`);
    return fromEnv;
  }
  const bundled = bundledLightpandaPath();
  if (fs.existsSync(bundled)) return extractBundledLightpanda(bundled);
  const cached = homeCacheLightpandaPath();
  if (executableExists(cached)) return cached;
  throw new CliError(
    "Executable Lightpanda belum tersedia. Build release harus membawa bundled asset Lightpanda, atau set LIGHTPANDA_EXECUTABLE_PATH."
  );
}

function requireLightpanda() {
  try {
    return require("@lightpanda/browser/dist/index.cjs").lightpanda;
  } catch (error) {
    throw new CliError(`Dependency @lightpanda/browser belum tersedia: ${error.message || error}`);
  }
}

function requirePuppeteerCore() {
  try {
    return require("puppeteer-core");
  } catch (error) {
    throw new CliError(`Dependency puppeteer-core belum tersedia: ${error.message || error}`);
  }
}

async function freeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

class LightpandaPlayer {
  constructor(options = {}) {
    this.engine = "lightpanda";
    this.options = options;
    this.browserUserAgent = options.browserUserAgent || "";
    this.timeout = Math.max(5, Number.parseInt(options.timeout || 30, 10) || 30);
    this.server = new PlayerServer({
      host: options.host || "127.0.0.1",
      port: Number.parseInt(options.port || 0, 10) || 0,
    });
    this.serverInfo = null;
    this.lightpandaProcess = null;
    this.browser = null;
    this.page = null;
    this.cdpHost = options.cdpHost || "127.0.0.1";
    this.cdpPort = Number.parseInt(options.cdpPort || 0, 10) || 0;
    this.devtoolsMode = "off";
    this.devtoolsPublicHost = "127.0.0.1";
    this.devtoolsProxy = null;
    this.devtoolsProxyInfo = null;
    this.internalCdpHost = "127.0.0.1";
    this.internalCdpPort = 0;
    this.executablePath = "";
  }

  async start() {
    if (this.browser) return this.info();
    this.executablePath = resolveLightpandaExecutable();
    process.env.LIGHTPANDA_EXECUTABLE_PATH = this.executablePath;
    const lightpanda = requireLightpanda();
    const puppeteer = requirePuppeteerCore();
    this.serverInfo = await this.server.start();
    const devtools = await resolveStartDevtoolsOptions({
      remoteDebuggingPort: this.cdpPort || undefined,
      remoteDebuggingHost: this.cdpHost || undefined,
    });
    this.devtoolsMode = devtools.mode;
    this.devtoolsPublicHost = devtools.publicHost || "127.0.0.1";
    this.internalCdpHost = devtools.proxy ? "127.0.0.1" : (devtools.bind || this.cdpHost || "127.0.0.1");
    this.internalCdpPort = devtools.port > 0 ? (devtools.proxy ? await freeLoopbackPort() : devtools.port) : await freeLoopbackPort();
    this.cdpHost = devtools.proxy ? (devtools.bind || "0.0.0.0") : this.internalCdpHost;
    this.cdpPort = devtools.port > 0 ? devtools.port : this.internalCdpPort;
    this.lightpandaProcess = await lightpanda.serve({ host: this.internalCdpHost, port: this.internalCdpPort });
    if (devtools.proxy) {
      this.devtoolsProxy = new DevtoolsProxy({
        listenHost: devtools.bind || "0.0.0.0",
        listenPort: devtools.port,
        targetHost: this.internalCdpHost,
        targetPort: this.internalCdpPort,
        publicHost: this.devtoolsPublicHost,
      });
      await this.devtoolsProxy.start();
      this.devtoolsProxyInfo = {
        listenHost: devtools.bind || "0.0.0.0",
        listenPort: devtools.port,
        targetHost: this.internalCdpHost,
        targetPort: this.internalCdpPort,
      };
    }
    this.browser = await puppeteer.connect({ browserURL: `http://${this.internalCdpHost}:${this.internalCdpPort}` });
    this.page = await this.browser.newPage();
    if (this.browserUserAgent) {
      try {
        await this.page.setUserAgent(this.browserUserAgent);
      } catch (_) {}
    }
    try {
      await this.page.setExtraHTTPHeaders({ "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" });
    } catch (_) {}
    await this.page.goto(this.serverInfo.url, { waitUntil: "domcontentloaded", timeout: this.navTimeout() });
    return this.info();
  }

  async play(url, meta = {}) {
    await this.start();
    this.server.setTask(url, meta);
    await this.syncPlayerPage();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { engine: this.engine, status: "loaded", playerUrl: this.serverInfo.url, cdpUrl: this.cdpUrl() };
  }

  async update(meta = {}) {
    if (!this.page) return { engine: this.engine };
    this.server.update(meta);
    await this.syncPlayerPage();
    return { engine: this.engine };
  }

  async clear(meta = {}) {
    if (!this.page) return { engine: this.engine };
    this.server.clear(meta);
    await this.syncPlayerPage();
    return { engine: this.engine };
  }

  async stop() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (_) {
        try {
          this.browser.disconnect();
        } catch (_) {}
      }
      this.browser = null;
      this.page = null;
    }
    if (this.lightpandaProcess) {
      try {
        this.lightpandaProcess.kill("SIGTERM");
      } catch (_) {}
      this.lightpandaProcess = null;
    }
    if (this.devtoolsProxy) {
      await this.devtoolsProxy.stop();
      this.devtoolsProxy = null;
      this.devtoolsProxyInfo = null;
    }
    await this.server.stop();
  }

  async syncPlayerPage() {
    if (!this.page) return;
    try {
      await this.page.evaluate(() => {
        if (window.SeoTaskPlayerSync) return window.SeoTaskPlayerSync();
        return null;
      });
    } catch (_) {
      await this.page.goto(this.serverInfo.url, { waitUntil: "domcontentloaded", timeout: this.navTimeout() });
    }
  }

  cdpUrl() {
    if (this.devtoolsMode === "public" || this.devtoolsMode === "frontend") return `http://${this.devtoolsPublicHost}:${this.cdpPort}`;
    if (this.devtoolsMode === "off") return null;
    return `http://${this.cdpHost}:${this.cdpPort}`;
  }

  info() {
    return {
      engine: this.engine,
      playerUrl: this.serverInfo ? this.serverInfo.url : null,
      cdpUrl: this.cdpPort ? this.cdpUrl() : null,
      cdpInternalUrl: this.internalCdpPort ? `http://${this.internalCdpHost}:${this.internalCdpPort}` : null,
      devtoolsMode: this.devtoolsMode,
      devtoolsProxy: this.devtoolsProxyInfo,
      executablePath: this.executablePath || null,
    };
  }

  navTimeout() {
    return Math.max(5000, this.timeout * 1000);
  }
}

module.exports = {
  LightpandaPlayer,
  resolveLightpandaExecutable,
  lightpandaRuntimeDir,
};
