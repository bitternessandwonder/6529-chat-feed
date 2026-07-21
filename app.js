"use strict";

const feedElement = document.querySelector("#feed");
const loadingElement = document.querySelector("#loading-box");
const errorElement = document.querySelector("#error-box");
const refreshButton = document.querySelector("#refresh-button");
const loadMoreButton = document.querySelector("#load-more-button");
const searchInput = document.querySelector("#search-input");
const messageCount = document.querySelector("#message-count");
const lastUpdated = document.querySelector("#last-updated");
const chatTemplate = document.querySelector("#chat-template");

const PAGE_SIZE = 100;
const REFRESH_INTERVAL_MS = 30_000;

let currentPage = 0;
let hasMore = true;
let isLoading = false;
let allChats = [];
let refreshTimer = null;

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function stringValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function authorName(drop) {
  const fullAddress = stringValue(
    drop?.author?.primary_address,
    drop?.author?.address,
    drop?.profile?.primary_address,
    drop?.signer_address
  );

  const handle = stringValue(
    drop?.author?.handle,
    drop?.author?.profile?.handle,
    drop?.profile?.handle,
    drop?.author_handle
  );

  if (handle) return handle;
  if (fullAddress.length > 12) {
    return `${fullAddress.slice(0, 6)}…${fullAddress.slice(-4)}`;
  }
  return fullAddress || "Unknown author";
}

function authorImage(drop) {
  return stringValue(
    drop?.author?.pfp,
    drop?.author?.profile?.pfp,
    drop?.profile?.pfp,
    drop?.author?.image
  );
}

function waveName(drop) {
  return stringValue(
    drop?.wave?.name,
    drop?.wave_name,
    drop?.wave?.title,
    drop?.wave_id
  ) || "Unknown wave";
}

function extractText(drop) {
  const directText = stringValue(
    drop?.content,
    drop?.message,
    drop?.text,
    drop?.body
  );

  if (directText) return directText;

  const texts = arrayValue(drop?.parts)
    .map((part) =>
      stringValue(
        part?.content,
        part?.text,
        part?.message,
        part?.body,
        typeof part === "string" ? part : ""
      )
    )
    .filter(Boolean);

  return texts.join("\n\n");
}

function extractMedia(drop) {
  const found = [];
  const seen = new Set();

  function add(url, mimeType = "") {
    if (!url || typeof url !== "string" || seen.has(url)) return;
    seen.add(url);
    found.push({ url, mimeType: String(mimeType || "") });
  }

  for (const item of arrayValue(drop?.media)) {
    add(item?.url || item?.media_url, item?.mime_type || item?.content_type);
  }

  for (const part of arrayValue(drop?.parts)) {
    add(part?.media_url || part?.url, part?.mime_type || part?.content_type);
    for (const item of arrayValue(part?.media)) {
      add(item?.url || item?.media_url, item?.mime_type || item?.content_type);
    }
  }

  return found;
}

function timestampMilliseconds(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number < 1_000_000_000_000 ? number * 1000 : number;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function createdAt(drop) {
  return timestampMilliseconds(
    drop?.created_at ?? drop?.createdAt ?? drop?.timestamp ?? drop?.created
  );
}

function dropKey(drop, index = 0) {
  return stringValue(
    drop?.id,
    drop?.drop_id,
    drop?.serial_no,
    `${authorName(drop)}:${createdAt(drop) || "unknown"}:${extractText(drop)}:${index}`
  );
}

function serialLabel(drop) {
  const serial = stringValue(drop?.serial_no, drop?.serial, drop?.id);
  return serial ? `Drop ${serial}` : "6529 drop";
}

function formatDate(milliseconds) {
  if (!milliseconds) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(milliseconds));
}

function initial(name) {
  return Array.from(name.trim())[0]?.toUpperCase() || "?";
}

function mergeChats(incoming, replace = false) {
  const merged = new Map();

  if (!replace) {
    allChats.forEach((drop, index) => merged.set(dropKey(drop, index), drop));
  }

  incoming.forEach((drop, index) => merged.set(dropKey(drop, index), drop));

  allChats = [...merged.values()].sort(
    (a, b) => (createdAt(b) || 0) - (createdAt(a) || 0)
  );
}

function renderMedia(container, media) {
  container.replaceChildren();

  for (const item of media) {
    const mime = item.mimeType.toLowerCase();
    const urlLower = item.url.toLowerCase();

    if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)(\?|$)/.test(urlLower)) {
      const image = document.createElement("img");
      image.src = item.url;
      image.alt = "Media attached to this chat";
      image.loading = "lazy";
      container.append(image);
      continue;
    }

    if (mime.startsWith("video/") || /\.(mp4|webm|mov)(\?|$)/.test(urlLower)) {
      const video = document.createElement("video");
      video.src = item.url;
      video.controls = true;
      video.preload = "metadata";
      container.append(video);
      continue;
    }

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open attached media";
    container.append(link);
  }
}

function renderFeed() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleChats = query
    ? allChats.filter((drop) => {
        const searchable = [
          authorName(drop),
          waveName(drop),
          stringValue(drop?.title),
          extractText(drop),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      })
    : allChats;

  feedElement.replaceChildren();

  if (!visibleChats.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = allChats.length
      ? "No loaded chats match that filter."
      : "No public CHAT drops were returned.";
    feedElement.append(empty);
  } else {
    const fragment = document.createDocumentFragment();

    visibleChats.forEach((drop) => {
      const card = chatTemplate.content.firstElementChild.cloneNode(true);
      const name = authorName(drop);
      const imageUrl = authorImage(drop);
      const text = extractText(drop);
      const title = stringValue(drop?.title);

      const avatar = card.querySelector(".avatar");
      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("error", () => {
          avatar.replaceChildren(initial(name));
        });
        avatar.append(image);
      } else {
        avatar.textContent = initial(name);
      }

      card.querySelector(".author").textContent = name;
      card.querySelector(".wave").textContent = waveName(drop);

      const time = card.querySelector(".time");
      const timeValue = createdAt(drop);
      time.textContent = formatDate(timeValue);
      if (timeValue) time.dateTime = new Date(timeValue).toISOString();

      const titleElement = card.querySelector(".title");
      if (title) {
        titleElement.textContent = title;
        titleElement.classList.remove("hidden");
      }

      const message = card.querySelector(".message");
      message.textContent = text || "[Media attachment or empty message]";
      if (!text) message.classList.add("empty");

      renderMedia(card.querySelector(".media"), extractMedia(drop));
      card.querySelector(".serial").textContent = serialLabel(drop);

      fragment.append(card);
    });

    feedElement.append(fragment);
  }

  messageCount.textContent =
    query && visibleChats.length !== allChats.length
      ? `${visibleChats.length} of ${allChats.length} chats`
      : `${allChats.length} ${allChats.length === 1 ? "chat" : "chats"}`;
}

function setLoading(value, loadingOlder = false) {
  isLoading = value;
  refreshButton.disabled = value;
  loadMoreButton.disabled = value;
  refreshButton.textContent = value && !loadingOlder ? "Refreshing…" : "Refresh";
  loadMoreButton.textContent = value && loadingOlder ? "Loading…" : "Load older chats";

  if (!allChats.length && value) {
    loadingElement.classList.remove("hidden");
  } else {
    loadingElement.classList.add("hidden");
  }
}

function showError(error) {
  const message =
    error instanceof Error ? error.message : "Something went wrong loading the feed.";
  errorElement.textContent =
    `${message}\n\nMake sure you are online. If this continues, the 6529 API may be unavailable or its response format may have changed.`;
  errorElement.classList.remove("hidden");
}

function clearError() {
  errorElement.textContent = "";
  errorElement.classList.add("hidden");
}

async function fetchPage(page, { replace = false, loadingOlder = false } = {}) {
  if (isLoading) return;

  setLoading(true, loadingOlder);
  clearError();

  try {
    const response = await fetch(
      `/api/chats?page=${page}&page_size=${PAGE_SIZE}`,
      { cache: "no-store" }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `Feed request failed with HTTP ${response.status}.`);
    }

    const incoming = arrayValue(payload.data);
    mergeChats(incoming, replace);
    currentPage = page;
    hasMore = Boolean(payload.has_more);

    loadMoreButton.classList.toggle("hidden", !hasMore);
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    renderFeed();
  } catch (error) {
    showError(error);
  } finally {
    setLoading(false, loadingOlder);
  }
}

async function refreshLatest() {
  await fetchPage(1, { replace: false });
}

refreshButton.addEventListener("click", refreshLatest);
loadMoreButton.addEventListener("click", () =>
  fetchPage(currentPage + 1, { loadingOlder: true })
);
searchInput.addEventListener("input", renderFeed);

fetchPage(1, { replace: true });

refreshTimer = window.setInterval(() => {
  if (!document.hidden) refreshLatest();
}, REFRESH_INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});
