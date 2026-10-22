/* Stepwell service worker — offline reading of insights and visited pages.
   Never caches chat (POST), admin or personal data. Bump VERSION to invalidate. */
const VERSION = "v1";
const STATIC = `stepwell-static-${VERSION}`;
const PAGES = `stepwell-pages-${VERSION}`;
const API = `stepwell-api-${VERSION}`;
const PRECACHE = ["/offline.html", "/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const CACHEABLE_API = /\/api\/v1\/(insights|topics|meta|documents|chunks)(\/|\?|$)/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => put(STATIC, request, res))));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (!CACHEABLE_API.test(url.pathname + url.search)) return;
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (request.mode === "navigate") {
    if (/\/(admin|profile)(\/|$)/.test(url.pathname)) return;
    event.respondWith(
      fetch(request)
        .then((res) => put(PAGES, request, res))
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/offline.html"))),
    );
  }
});

function put(cacheName, request, response) {
  if (response && response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy));
  }
  return response;
}

function staleWhileRevalidate(request) {
  return caches.open(API).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
}
