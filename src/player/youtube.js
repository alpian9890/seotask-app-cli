"use strict";

function cleanVideoId(value) {
  const match = String(value || "").trim().match(/^[A-Za-z0-9_-]{6,}$/);
  return match ? match[0] : null;
}

function extractYouTubeVideoId(input) {
  const text = String(input || "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return cleanVideoId(url.pathname.slice(1));
    if (host.endsWith("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) return cleanVideoId(url.pathname.split("/")[2]);
      if (url.pathname.startsWith("/shorts/")) return cleanVideoId(url.pathname.split("/")[2]);
      if (url.pathname.startsWith("/watch")) return cleanVideoId(url.searchParams.get("v"));
    }
  } catch (_) {}
  const match = text.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return match ? cleanVideoId(match[1]) : null;
}

function toEmbedUrl(input) {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    controls: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    vq: "tiny",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

module.exports = {
  cleanVideoId,
  extractYouTubeVideoId,
  toEmbedUrl,
};
