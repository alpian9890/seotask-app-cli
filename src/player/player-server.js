"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { toEmbedUrl } = require("./youtube");

class PlayerServer {
  constructor(options = {}) {
    this.host = options.host || "127.0.0.1";
    this.port = Number.parseInt(options.port || 0, 10) || 0;
    this.server = null;
    this.current = this.emptyState({ status: "WAIT", message: "Waiting for task" });
    this.htmlPath = path.resolve(__dirname, "..", "ui", "player.html");
  }

  async start() {
    if (this.server) return this.info();
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, resolve);
    });
    return this.info();
  }

  async stop() {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => server.close(resolve));
  }

  info() {
    const address = this.server && this.server.address();
    const port = address && typeof address === "object" ? address.port : this.port;
    return {
      host: this.host,
      port,
      url: `http://${this.host}:${port}/`,
    };
  }

  emptyState(meta = {}) {
    return {
      status: meta.status || "WAIT",
      message: meta.message || "",
      reason: meta.reason || "",
      sourceUrl: "",
      embedUrl: "",
      videoId: "",
      idStatus: meta.idStatus || "",
      timer: Number.parseInt(meta.timer || 0, 10) || 0,
      startedAt: meta.startedAt || "",
      reward: meta.reward || "",
      balance: meta.balance || "",
      updatedAt: new Date().toISOString(),
    };
  }

  setTask(url, meta = {}) {
    const embedUrl = toEmbedUrl(url);
    if (!embedUrl) throw new Error(`URL YouTube tidak valid untuk iframe: ${url}`);
    const videoId = embedUrl.split("/embed/")[1].split("?")[0];
    this.current = {
      ...this.current,
      ...meta,
      status: meta.status || "TASK",
      message: meta.message || "Task running",
      reason: meta.reason || "",
      sourceUrl: String(url),
      embedUrl,
      videoId: meta.videoId || videoId,
      idStatus: meta.idStatus || "",
      timer: Number.parseInt(meta.timer || 0, 10) || 0,
      startedAt: meta.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.current;
  }

  update(meta = {}) {
    this.current = { ...this.current, ...meta, updatedAt: new Date().toISOString() };
    return this.current;
  }

  clear(meta = {}) {
    this.current = this.emptyState({
      status: meta.status || "WAIT",
      message: meta.message || meta.reason || "No active task",
      reason: meta.reason || meta.message || "",
      reward: meta.reward || this.current.reward || "",
      balance: meta.balance || this.current.balance || "",
      idStatus: meta.idStatus || "",
      timer: meta.timer || 0,
      startedAt: meta.startedAt || "",
    });
    return this.current;
  }

  handle(req, res) {
    try {
      const parsed = new URL(req.url || "/", this.info().url);
      if (parsed.pathname === "/state") return this.sendJson(res, this.current);
      if (parsed.pathname === "/set") {
        this.setTask(parsed.searchParams.get("url") || "", {
          idStatus: parsed.searchParams.get("id_status") || "",
          timer: parsed.searchParams.get("timer") || 0,
          message: parsed.searchParams.get("message") || "Task running",
        });
        return this.redirect(res, "/");
      }
      if (parsed.pathname === "/clear") {
        this.clear();
        return this.redirect(res, "/");
      }
      if (parsed.pathname === "/" || parsed.pathname === "/player.html") {
        const html = fs.readFileSync(this.htmlPath, "utf8");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(html);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.message || String(error));
    }
  }

  sendJson(res, payload) {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(payload));
  }

  redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
  }
}

module.exports = {
  PlayerServer,
};
