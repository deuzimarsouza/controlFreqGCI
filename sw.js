"use strict";

// Change the version whenever an app file changes. Each release is cached as a set.
const APP_VERSION = "2026-09-07-18";
const APP_SCOPE = self.registration.scope;
const CACHE_PREFIX = `producao-gci-${encodeURIComponent(new URL(APP_SCOPE).pathname)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const SHELL_FILES = [
  "index.html", "style.css", "script.js", "pdf-export.js", "pwa.js",
  "vendor/jspdf.umd.min.js", "manifest.webmanifest",
  "src/logo-instituicao.png", "src/book-alt.png", "src/document.png",
  "src/file-excel.png", "src/upload.png", "src/magic-wand.png",
  "src/icons/icon-192.png", "src/icons/icon-512.png", "src/icons/icon-maskable-512.png"
];
const SHELL_URLS = SHELL_FILES.map(path => new URL(path, APP_SCOPE).href);
const SHELL_URL_SET = new Set(SHELL_URLS);
const INDEX_URL = new URL("index.html", APP_SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll is atomic: an incomplete download never becomes the active release.
    await cache.addAll(SHELL_URLS.map(url => new Request(url, { cache: "reload" })));
    // Do not skipWaiting: a new version must not interrupt an imported report.
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cachedAsset(url, originalRequest) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached;
  } catch {
    // Storage restrictions must not prevent normal online use.
  }

  // Recover individual files if the browser has removed cached storage.
  const response = await fetch(originalRequest);
  if (cache && response.ok && response.type === "basic") {
    await cache.put(url, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";

  // Only app files are cached. Imported reports and exported documents are not.
  const normalizedUrl = url.href;
  if (request.mode === "navigate" && (normalizedUrl === APP_SCOPE || normalizedUrl === INDEX_URL)) {
    event.respondWith(cachedAsset(INDEX_URL, request));
  } else if (SHELL_URL_SET.has(normalizedUrl)) {
    event.respondWith(cachedAsset(normalizedUrl, request));
  }
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CHECK_OFFLINE_READY" || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const entries = await Promise.all(SHELL_URLS.map(url => cache.match(url)));
      event.ports[0].postMessage({ type: "OFFLINE_STATUS", ready: entries.every(Boolean) });
    } catch {
      event.ports[0].postMessage({ type: "OFFLINE_STATUS", ready: false });
    }
  })());
});


