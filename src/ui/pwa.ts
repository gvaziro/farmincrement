/**
 * PWA glue: the service worker (production builds only — in development it
 * would cache over hot reloads) and the browser's "install the app" prompt.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPrompt | null = null;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function setupPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  // An offer caught by the early script in the layout, before this code loaded.
  const early = (window as Window & { __installPrompt?: InstallPrompt }).__installPrompt;
  if (early) deferred = early;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep it for the "Install" button in the settings instead of the browser's banner.
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") {
    // A worker left behind by a production build at this address would serve stale pages.
    void navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => void r.unregister()));
    return;
  }
  navigator.serviceWorker
    .register("/sw.js")
    .then(async () => {
      const reg = await navigator.serviceWorker.ready;
      // What this page loaded before the worker took over: so the very first visit is enough to play offline.
      const urls = [location.pathname, ...performance.getEntriesByType("resource").map((e) => e.name)];
      reg.active?.postMessage({ type: "warm", urls });
    })
    .catch(() => {
      /* no worker: the game still runs, just not offline */
    });
}

/** The browser offered to install the game (Chrome, Edge, Android). */
export const canInstall = () => deferred !== null;

/** Show the browser's install dialog. Resolves to whether the player agreed. */
export async function install() {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  notify();
  await d.prompt();
  return (await d.userChoice).outcome === "accepted";
}

export function onInstallChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Already running as an installed app (home screen or its own window). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** iPhone / iPad: no install prompt there — "Share → Add to Home Screen". */
export const isIos = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
