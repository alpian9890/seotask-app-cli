"use strict";

const http = require("http");
const net = require("net");
const { CLI_VERSION } = require("../config/constants");
const { CliError, UsageError } = require("./errors");
const { atomicWriteJson, devtoolsPath, nowUtc, readJson } = require("./utils");
const { httpRequest } = require("./http");

function defaultDevtoolsConfig() {
  return {
    mode: "off",
    port: 9222,
    bind: "127.0.0.1",
    public_host: "127.0.0.1",
    updated_at: nowUtc(),
  };
}

function normalizeDevtoolsMode(value) {
  const mode = String(value || "off").trim().toLowerCase();
  if (!["off", "local", "public", "frontend"].includes(mode)) {
    throw new UsageError("mode devtools harus salah satu: off, local, public, frontend");
  }
  return mode;
}

function normalizePort(value, fallback = 9222) {
  const port = Number.parseInt(value === undefined || value === null || value === "" ? fallback : value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new UsageError("port harus angka 1-65535");
  return port;
}

function loadDevtoolsConfig() {
  const saved = readJson(devtoolsPath()) || {};
  const config = { ...defaultDevtoolsConfig(), ...saved };
  config.mode = normalizeDevtoolsMode(config.mode);
  config.port = normalizePort(config.port, 9222);
  if (!config.bind) config.bind = config.mode === "local" ? "127.0.0.1" : "0.0.0.0";
  if (!config.public_host) config.public_host = config.mode === "local" ? "127.0.0.1" : "127.0.0.1";
  return config;
}

function saveDevtoolsConfig(config) {
  const saved = {
    mode: normalizeDevtoolsMode(config.mode),
    port: normalizePort(config.port, 9222),
    bind: String(config.bind || "127.0.0.1").trim(),
    public_host: String(config.public_host || "127.0.0.1").trim(),
    updated_at: nowUtc(),
  };
  atomicWriteJson(devtoolsPath(), saved);
  return saved;
}

async function resolveStartDevtoolsOptions(args = {}) {
  const config = loadDevtoolsConfig();
  const explicitPort = args.remoteDebuggingPort !== undefined && args.remoteDebuggingPort !== null && args.remoteDebuggingPort !== "";
  const port = explicitPort ? normalizePort(args.remoteDebuggingPort, config.port) : (config.mode === "off" ? 0 : config.port);
  const bind = args.remoteDebuggingHost || (explicitPort ? "0.0.0.0" : config.bind);
  let publicHost = args.remoteDebuggingPublicHost || config.public_host;
  if (port > 0 && ["public", "frontend"].includes(config.mode) && (!publicHost || publicHost === "127.0.0.1")) {
    const { publicIpAddress } = require("./auth");
    publicHost = await publicIpAddress();
  }
  return {
    mode: port > 0 ? (explicitPort ? "custom" : config.mode) : "off",
    port,
    bind,
    publicHost,
    proxy: port > 0 && !explicitPort && ["public", "frontend"].includes(config.mode),
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class DevtoolsProxy {
  constructor({ listenHost, listenPort, targetHost, targetPort, publicHost }) {
    this.listenHost = listenHost;
    this.listenPort = listenPort;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    this.publicHost = publicHost || listenHost || "127.0.0.1";
    this.server = null;
  }

  start() {
    if (this.server) return Promise.resolve();
    this.server = http.createServer((request, response) => this.handleHttp(request, response));
    this.server.on("upgrade", (request, socket, head) => this.handleUpgrade(request, socket, head));
    return new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server = null;
        reject(error);
      };
      this.server.once("error", onError);
      this.server.listen(this.listenPort, this.listenHost, () => {
        this.server.off("error", onError);
        resolve();
      });
    });
  }

  handleHttp(request, response) {
    const headers = { ...request.headers, host: `${this.targetHost}:${this.targetPort}` };
    delete headers["accept-encoding"];
    const upstream = http.request({
      host: this.targetHost,
      port: this.targetPort,
      method: request.method,
      path: request.url,
      headers,
    }, (upstreamResponse) => {
      const chunks = [];
      upstreamResponse.on("data", (chunk) => chunks.push(chunk));
      upstreamResponse.on("end", () => {
        const original = Buffer.concat(chunks);
        const rewritten = this.rewriteBody(original, upstreamResponse.headers);
        const responseHeaders = { ...upstreamResponse.headers };
        delete responseHeaders["transfer-encoding"];
        responseHeaders["content-length"] = Buffer.byteLength(rewritten);
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, responseHeaders);
        response.end(rewritten);
      });
    });
    upstream.on("error", (error) => {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end(`DevTools proxy error: ${error.message}`);
    });
    request.pipe(upstream);
  }

  handleUpgrade(request, socket, head) {
    const upstream = net.connect({ host: this.targetHost, port: this.targetPort }, () => {
      const headers = { ...request.headers, host: `${this.targetHost}:${this.targetPort}` };
      const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
      for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
          for (const item of value) lines.push(`${key}: ${item}`);
        } else if (value !== undefined) {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push("", "");
      upstream.write(lines.join("\r\n"));
      if (head && head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    const destroyBoth = () => {
      socket.destroy();
      upstream.destroy();
    };
    socket.on("error", destroyBoth);
    upstream.on("error", destroyBoth);
  }

  rewriteBody(body, headers) {
    const contentType = String(headers["content-type"] || "");
    if (!/(json|javascript|text)/i.test(contentType)) return body;
    let text = body.toString("utf8");
    const target = `${this.targetHost}:${this.targetPort}`;
    const published = `${this.publicHost}:${this.listenPort}`;
    text = text
      .replace(new RegExp(`ws://${escapeRegExp(target)}`, "g"), `ws://${published}`)
      .replace(new RegExp(`ws=${escapeRegExp(target)}`, "g"), `ws=${published}`)
      .replace(new RegExp(escapeRegExp(target), "g"), published);
    return Buffer.from(text, "utf8");
  }

  stop() {
    if (!this.server) return Promise.resolve();
    const server = this.server;
    this.server = null;
    return new Promise((resolve) => server.close(() => resolve()));
  }
}

async function devtoolsFrontendUrls(config = loadDevtoolsConfig()) {
  const requestJson = async (endpoint) => {
    const response = await httpRequest(`http://127.0.0.1:${config.port}${endpoint}`, {
      method: "GET",
      headers: { "User-Agent": `seotask/${CLI_VERSION}` },
      timeout: 5,
      retries: 1,
      maxBodyBytes: 1000000,
    });
    if (response.status >= 400) throw new CliError(`DevTools endpoint HTTP ${response.status}.`);
    try {
      return JSON.parse(response.body.toString("utf8"));
    } catch (error) {
      throw new CliError(`Respons DevTools bukan JSON valid: ${error.message}`);
    }
  };
  let pages = await requestJson("/json/list");
  if (!Array.isArray(pages)) pages = [];
  const host = config.public_host || "127.0.0.1";
  const pageUrls = pages
    .filter((page) => page && (page.type === "page" || page.webSocketDebuggerUrl || page.id))
    .map((page) => {
      const wsUrl = String(page.webSocketDebuggerUrl || "").replace(/^ws:\/\/[^/]+\/?/, "");
      const frontend = page.devtoolsFrontendUrl
        ? String(page.devtoolsFrontendUrl).replace(/ws=127\.0\.0\.1:\d+/g, `ws=${host}:${config.port}`)
        : `https://chrome-devtools-frontend.appspot.com/serve_file/@latest/inspector.html?ws=${host}:${config.port}/${wsUrl || `devtools/page/${page.id}`}`;
      return {
        title: page.title || page.url || page.id || "-",
        url: frontend,
        page_url: page.url || "",
      };
    });
  if (pageUrls.length) return pageUrls;
  const version = await requestJson("/json/version");
  const wsUrl = String(version.webSocketDebuggerUrl || "").replace(/^ws:\/\/[^/]+\/?/, "");
  if (!wsUrl && !version.webSocketDebuggerUrl) return [];
  return [{
    title: version.Browser || "Lightpanda DevTools",
    url: `https://chrome-devtools-frontend.appspot.com/serve_file/@latest/inspector.html?ws=${host}:${config.port}/${wsUrl}`,
    page_url: "",
  }];
}

module.exports = {
  DevtoolsProxy,
  defaultDevtoolsConfig,
  normalizeDevtoolsMode,
  normalizePort,
  loadDevtoolsConfig,
  saveDevtoolsConfig,
  resolveStartDevtoolsOptions,
  devtoolsFrontendUrls,
};
