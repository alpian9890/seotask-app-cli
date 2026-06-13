"use strict";

const { httpRequest } = require("../lib/http");

class TouchPlayer {
  constructor(options = {}) {
    this.engine = "touch";
    this.userAgent = options.browserUserAgent || options.userAgent || "";
    this.youtubeCookie = options.youtubeCookie || "";
    this.timeout = Math.max(5, Number.parseInt(options.timeout || 30, 10) || 30);
    this.lastStatus = null;
  }

  async start() {
    return { engine: this.engine };
  }

  async play(url) {
    const headers = {
      "User-Agent": this.userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    };
    if (this.youtubeCookie) headers.Cookie = this.youtubeCookie;
    try {
      const response = await httpRequest(url, { method: "GET", headers, timeout: this.timeout, maxBodyBytes: 200000 });
      this.lastStatus = response.status;
      return { engine: this.engine, status: response.status };
    } catch (error) {
      this.lastStatus = null;
      return { engine: this.engine, status: null, error: error.message || String(error) };
    }
  }

  async update() {
    return { engine: this.engine, status: this.lastStatus };
  }

  async clear() {
    this.lastStatus = null;
    return { engine: this.engine };
  }

  async stop() {
    return { engine: this.engine };
  }
}

class NullPlayer {
  constructor() {
    this.engine = "none";
  }

  async start() {
    return { engine: this.engine };
  }

  async play() {
    return { engine: this.engine, status: "skipped" };
  }

  async update() {
    return { engine: this.engine };
  }

  async clear() {
    return { engine: this.engine };
  }

  async stop() {
    return { engine: this.engine };
  }
}

module.exports = {
  TouchPlayer,
  NullPlayer,
};
