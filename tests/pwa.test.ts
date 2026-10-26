/** Phase 21: what makes the game installable and playable offline. */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("the app manifest", () => {
  it("has the PNG icons browsers want for installing, and a maskable one", () => {
    const m = manifest();
    const icons = m.icons ?? [];
    for (const size of ["192x192", "512x512"]) expect(icons.some((i) => i.sizes === size && i.type === "image/png" && i.purpose === "any"), size).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("fullscreen");
  });
});

// ── the service worker, run for real against a fake network and cache ─────
const ORIGIN = "https://farm.test";
const SW = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

type Net = (req: Request) => Promise<Response>;

/** public/sw.js in a sandbox: Cache Storage in memory, `net` plays the network. */
function worker(net: Net) {
  const stores = new Map<string, Map<string, Response>>();
  let quotaFull = false;
  const calls: string[] = [];
  const key = (r: Request | string) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);
  const cacheOf = (m: Map<string, Response>) => ({
    async match(r: Request | string) {
      return m.get(key(r))?.clone();
    },
    async put(r: Request | string, res: Response) {
      if (quotaFull) throw new DOMException("full", "QuotaExceededError");
      await res.clone().arrayBuffer();
      m.delete(key(r));
      m.set(key(r), res);
    },
    async addAll(list: string[]) {
      for (const u of list) await this.put(u, await doFetch(new Request(key(u))));
    },
    async keys() {
      return [...m.keys()].map((u) => new Request(u));
    },
    async delete(r: Request | string) {
      return m.delete(key(r));
    },
  });
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      return cacheOf(stores.get(name)!);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  const doFetch = (r: Request | string) => {
    const req = typeof r === "string" ? new Request(key(r)) : r;
    calls.push(new URL(req.url).pathname);
    return net(req);
  };
  const handlers: Record<string, (e: unknown) => void> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  // Timers fire at once: "the network is slow" is decided straight away.
  const setTimeoutNow = (fn: () => void) => setTimeout(fn, 0);
  vm.runInContext(SW, vm.createContext({ self, caches, fetch: doFetch, URL, Request, Response, Promise, setTimeout: setTimeoutNow, Error, Set, Array, DOMException }));

  /**
   * Fire an event; resolves with its response (if any) once its waitUntil work
   * has settled — or after a moment, for work that waits on a network that never answers.
   */
  async function fire(type: string, init: Record<string, unknown>) {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | null = null;
    handlers[type]({ ...init, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => (responded = p) });
    const res = responded ? await (responded as Promise<Response>) : null;
    // waitUntil may be called while the response is being made: wait for all of them.
    await Promise.race([(async () => {
      for (let i = 0; i < waits.length; i++) await waits[i];
    })(), new Promise((r) => setTimeout(r, 100))]);
    return res;
  }
  const get = (path: string) => fire("fetch", { request: new Request(`${ORIGIN}${path}`) });
  const navigate = (path: string) => {
    const request = new Request(`${ORIGIN}${path}`);
    Object.defineProperty(request, "mode", { value: "navigate" });
    return fire("fetch", { request });
  };
  return {
    fire,
    get,
    navigate,
    calls,
    stores,
    setQuotaFull: (v: boolean) => (quotaFull = v),
    cached: (store: string) => [...(stores.get(store)?.keys() ?? [])].map((u) => new URL(u).pathname),
  };
}

const ok = (body: string) => async () => new Response(body, { status: 200 });
const text = async (res: Response | null) => (res ? await res.text() : null);

describe("the service worker", () => {
  it("keeps the page and the manifest from the start", async () => {
    const w = worker(ok("page"));
    await w.fire("install", {});
    expect(w.cached("tfe-pages-v1")).toEqual(["/", "/manifest.webmanifest"]);
  });

  it("serves build files from the cache after the first time", async () => {
    const w = worker(ok("js"));
    expect(await text(await w.get("/_next/static/chunks/a.js"))).toBe("js");
    expect(await text(await w.get("/_next/static/chunks/a.js"))).toBe("js");
    expect(w.calls.filter((c) => c === "/_next/static/chunks/a.js").length).toBe(1);
  });

  it("still delivers a file when the cache is full", async () => {
    const w = worker(ok("js"));
    w.setQuotaFull(true);
    const res = await w.get("/_next/static/chunks/b.js");
    expect(res?.status).toBe(200);
    expect(await text(res)).toBe("js");
  });

  it("moves a file it serves again to the back of the queue, so trimming keeps it", async () => {
    const w = worker(ok("x"));
    await w.get("/_next/static/media/font.woff2");
    await w.get("/_next/static/chunks/c.js");
    await w.get("/_next/static/media/font.woff2");
    expect(w.cached("tfe-static-v1")).toEqual(["/_next/static/chunks/c.js", "/_next/static/media/font.woff2"]);
  });

  it("opens the game from the cache when the network is down, slow or broken", async () => {
    let net: Net = ok("fresh page");
    const w = worker((req) => net(req));
    await w.fire("install", {});
    expect(await text(await w.navigate("/"))).toBe("fresh page");
    net = async () => {
      throw new TypeError("offline");
    };
    expect(await text(await w.navigate("/"))).toBe("fresh page");
    expect(await text(await w.navigate("/?utm=x"))).toBe("fresh page");
    net = async () => new Response("bad gateway", { status: 502 });
    expect(await text(await w.navigate("/"))).toBe("fresh page");
    net = () => new Promise(() => {});
    expect(await text(await w.navigate("/"))).toBe("fresh page");
  });

  it("refreshes the cached page when the network answers", async () => {
    let page = "v1";
    const w = worker(async () => new Response(page));
    await w.fire("install", {});
    page = "v2";
    expect(await text(await w.navigate("/"))).toBe("v2");
    expect(await text(w.stores.get("tfe-pages-v1")!.get(`${ORIGIN}/`)!.clone())).toBe("v2");
  });

  it("warms the cache with what the page already loaded — only its own files", async () => {
    const w = worker(ok("x"));
    await w.fire("message", {
      data: { type: "warm", urls: ["/", `${ORIGIN}/_next/static/chunks/d.js`, "https://cdn.example/lib.js", `${ORIGIN}/api/secret`, "not a url ::"] },
    });
    expect(w.cached("tfe-static-v1")).toEqual(["/_next/static/chunks/d.js"]);
    expect(w.cached("tfe-pages-v1")).toEqual(["/"]);
  });

  it("leaves other requests to the browser", async () => {
    const w = worker(ok("x"));
    expect(await w.fire("fetch", { request: new Request(`${ORIGIN}/_next/static/chunks/e.js`, { method: "POST" }) })).toBeNull();
    expect(await w.fire("fetch", { request: new Request("https://cdn.example/_next/static/chunks/e.js") })).toBeNull();
    expect(await w.fire("fetch", { request: new Request(`${ORIGIN}/api/thing`) })).toBeNull();
  });

  it("keeps at most 300 build files", async () => {
    const w = worker(ok("x"));
    await w.fire("message", { data: { type: "warm", urls: Array.from({ length: 305 }, (_, i) => `/_next/static/chunks/${i}.js`) } });
    const files = w.cached("tfe-static-v1");
    expect(files.length).toBe(300);
    expect(files[0]).toBe("/_next/static/chunks/5.js");
  });
});
