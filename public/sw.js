// Navigation fallback only. Stage 4 adds push + notificationclick handlers here.
const CACHE = "fp-shell-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const isToday = new URL(request.url).pathname === "/app";
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isToday && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/app", copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE))),
  );
});
