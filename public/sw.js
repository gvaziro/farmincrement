/*
 * Tiny Farm Empire service worker: the game opens and plays without a network
 * (the farm itself lives in localStorage).
 *  - pages, the manifest and icons: network first — an update arrives as soon
 *    as there is a connection — with the cached copy when offline or slow;
 *  - build files (/_next/static/…, hashed names, never change): cache first.
 * The page tells the worker what it already loaded before the worker took
 * over ("warm"), so even the very first visit is enough to play offline.
 */
const PAGES = "tfe-pages-v1";
const STATIC = "tfe-static-v1";
/** Old builds' files are dropped beyond this many. */
const STATIC_LIMIT = 300;
/** A slow network loses to the cached page after this long. */
const NETWORK_TIMEOUT = 3500;

const isStatic = (url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
const isShell = (url) =>
  url.origin === self.location.origin &&
  (url.pathname === "/" || url.pathname === "/manifest.webmanifest" || url.pathname === "/icon.svg" || url.pathname.startsWith("/pwa-icon/") || url.pathname.startsWith("/apple-icon"));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest"]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "warm" && Array.isArray(data.urls)) event.waitUntil(warm(data.urls));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isStatic(url)) event.respondWith(cacheFirst(event));
  else if (req.mode === "navigate" || isShell(url)) event.respondWith(networkFirst(event));
});

async function cacheFirst(event) {
  const req = event.request;
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) {
    // Used again: to the back of the queue, so trimming drops what nobody needs any more.
    event.waitUntil(cache.put(req, hit.clone()).catch(() => {}));
    return hit;
  }
  const res = await fetch(req);
  // A full cache must not cost the player a file the network delivered fine.
  if (res.ok) event.waitUntil(cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {}));
  return res;
}

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(PAGES);
  const network = fetch(req);
  // Keep the worker alive until the fresh copy is saved: a slow answer still refreshes the cache.
  event.waitUntil(network.then((res) => (res.ok ? cache.put(req, res.clone()) : undefined)).catch(() => {}));
  const cached = async () => (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("/") : undefined);
  try {
    const res = await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), NETWORK_TIMEOUT))]);
    // A server that answers with an error is no better than no server: the cached game is.
    return res.ok ? res : (await cached()) || res;
  } catch {
    return (await cached()) || network;
  }
}

/** Cache what the page loaded before this worker was in charge. */
async function warm(urls) {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  for (const raw of urls) {
    let url;
    try {
      url = new URL(raw, self.location.origin);
    } catch {
      continue;
    }
    const cache = isStatic(url) ? statics : isShell(url) ? pages : null;
    if (!cache || (await cache.match(url.href))) continue;
    try {
      const res = await fetch(url.href);
      if (res.ok) await cache.put(url.href, res);
    } catch {
      /* offline already: nothing to warm */
    }
  }
  await trim(statics);
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - STATIC_LIMIT; i++) await cache.delete(keys[i]);
}
