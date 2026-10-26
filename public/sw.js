// Navigation fallback only: pages always come from the network, and the only thing cached
// is the public /offline page. Personal pages (e.g. /app) must never be cached here, because
// the cache outlives sign-out on a shared device. Push and notificationclick handlers are at the bottom.
const CACHE = "fp-shell-v3";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drops fp-shell-v1, which may hold a signed-in user's /app page.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      const cache = await caches.open(CACHE);
      await cache.delete("/app");
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE)) ?? Response.error();
    }),
  );
});

// Push: the server sends { title, body, url }; nothing personal travels in the payload.
self.addEventListener("push", (event) => {
  let data = { title: "I AM STRONG", body: "", url: "/app" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // A push without a readable payload still shows the club's name.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      data: { url: data.url },
      // Same tag = replace; the server gives every message its own, and a replacement still alerts.
      tag: data.tag || data.url,
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app", self.location.origin);
  // Never leave the app, whatever the payload said.
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/app";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Prefer a tab already on the page; otherwise the member app, never the admin.
      const open =
        windows.find((w) => w.url === url) ||
        windows.find((w) => w.url.startsWith(self.location.origin + "/app"));
      if (open) {
        try {
          await open.focus();
          if (open.url !== url && "navigate" in open) await open.navigate(url);
          return;
        } catch {
          // An uncontrolled client cannot be navigated: open a new window instead.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
