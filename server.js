"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const UPSTREAM_DROPS_URL =
  process.env.SIX529_DROPS_URL || "https://api.6529.io/api/v2/drops";

const MAX_PAGE_SIZE = 100;
const CACHE_TTL_MS = 10_000;
const responseCache = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function extractDrops(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.data,
    payload.drops,
    payload.items,
    payload.results,
    payload.data?.drops,
    payload.data?.items,
    payload.data?.results,
  ];

  return candidates.find(Array.isArray) || [];
}

function isChatDrop(drop) {
  return String(drop?.drop_type ?? drop?.type ?? "").toUpperCase() === "CHAT";
}

async function fetchChats(page, pageSize) {
  const cacheKey = `${page}:${pageSize}`;
  const cached = responseCache.get(cacheKey);

  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const upstreamUrl = new URL(UPSTREAM_DROPS_URL);
  upstreamUrl.searchParams.set("page", String(page));
  upstreamUrl.searchParams.set("page_size", String(pageSize));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "6529-chat-feed/1.0",
      },
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `6529 API returned HTTP ${response.status}: ${responseText.slice(0, 300)}`
      );
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error("6529 API returned a response that was not valid JSON.");
    }

    const upstreamDrops = extractDrops(payload);
    const chats = upstreamDrops.filter(isChatDrop);

    const value = {
      data: chats,
      page,
      page_size: pageSize,
      upstream_count: upstreamDrops.length,
      chat_count: chats.length,
      has_more: upstreamDrops.length >= pageSize,
    };

    responseCache.set(cacheKey, { savedAt: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requestedPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Content-Length": file.length,
      "Cache-Control":
        extension === ".html" ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(file);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    console.error(error);
    sendJson(res, 500, { error: "Unable to read the requested file." });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/chats") {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const page = positiveInteger(requestUrl.searchParams.get("page"), 1, 1_000_000);
      const pageSize = positiveInteger(
        requestUrl.searchParams.get("page_size"),
        MAX_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

      try {
        const result = await fetchChats(page, pageSize);
        sendJson(res, 200, result);
      } catch (error) {
        console.error("Feed request failed:", error);
        sendJson(res, 502, {
          error:
            error instanceof Error
              ? error.message
              : "Unable to contact the 6529 API.",
        });
      }
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(req, res, requestUrl.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Unexpected server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("6529 Chat Feed is running.");
  console.log(`Open: http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop it.");
  console.log("");
});
