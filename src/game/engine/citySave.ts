/**
 * The city in a save: like the farm, only what cannot be derived from the
 * layout and the completed pads. Customers are not saved: new ones come along.
 */
import { MACHINE_MAX_LEVEL, PLAYER_STATS, WORKER_STATS, statMaxLevel } from "../data/balance";
import { SHOPS, SHOP_MAX_LEVEL, TOWER_FLOORS, VAN_MAX_LEVEL, shelfById, shelfCapacity, tableById } from "../data/city";
import { ITEM_IDS, type ItemId } from "../data/items";
import { CITY_ZONES, machineById, type ZoneId } from "../data/layout";
import { createCityState, createShelf, createShop, createTable } from "./city";
import { calendarSeason } from "./seasons";
import { currentWeather } from "./weather";
import { TUTORIAL_DONE } from "./tutorial";
import type { GameState, Stats } from "./types";
import { applyStats, createMachine, createWorker } from "./world";

export interface CitySave {
  money: number;
  player: { x: number; z: number; facing: number; stack: ItemId[] };
  playerLevels: Record<string, number>;
  workerLevels: Record<string, number>;
  zones: ZoneId[];
  pads: Record<string, { paid: number; done: boolean }>;
  machines: Record<string, { level: number; inputs: Partial<Record<ItemId, number>>; output: number; progress?: number }>;
  workers: Record<string, { x: number; z: number; stack: ItemId[] }>;
  shops: Record<string, { level: number; ads: number; van: number; cash: number; bundles: number; delivery: boolean; shelves: Record<string, number>; tables: string[] }>;
  stats: Stats;
  tutorial: number;
  autoRate: number;
  dayClock: number;
  floors: number;
  finished: boolean;
  penny: number;
  bloggerIn: number;
  made: Partial<Record<string, number>>;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const ITEM_SET = new Set<string>(ITEM_IDS);
const items = (v: unknown): ItemId[] => (Array.isArray(v) ? (v.filter((x) => ITEM_SET.has(x)) as ItemId[]) : []);

export function serializeCity(st: GameState): CitySave {
  const city = st.city!;
  const pads: CitySave["pads"] = {};
  for (const p of st.pads) if (p.paid > 0 || p.done) pads[p.id] = { paid: Math.floor(p.paid * 100) / 100, done: p.done };
  const machines: CitySave["machines"] = {};
  for (const m of st.machines) machines[m.id] = { level: m.level, inputs: { ...m.inputs }, output: m.output, progress: m.working ? round2(m.progress) : undefined };
  const workers: CitySave["workers"] = {};
  for (const w of st.workers) workers[w.id] = { x: round2(w.x), z: round2(w.z), stack: [...w.stack] };
  const shops: CitySave["shops"] = {};
  for (const s of city.shops) {
    // Goods a customer already holds are on their way out, whatever happens.
    shops[s.id] = {
      level: s.level,
      ads: s.ads,
      van: s.van.level,
      cash: round2(s.cash),
      bundles: s.bundles,
      delivery: s.delivery,
      shelves: Object.fromEntries(s.shelves.map((x) => [x.id, x.count])),
      tables: s.tables.map((t) => t.id),
    };
  }
  return {
    money: round2(st.money),
    player: { x: round2(st.player.x), z: round2(st.player.z), facing: round2(st.player.facing), stack: [...st.player.stack] },
    playerLevels: { ...st.playerLevels },
    workerLevels: { ...st.workerLevels },
    zones: [...st.zones],
    pads,
    machines,
    workers,
    shops,
    stats: { ...st.stats },
    tutorial: st.tutorial,
    autoRate: st.autoIncome.rate,
    dayClock: Math.floor(st.dayClock * 100) / 100,
    floors: city.floors,
    finished: city.finished,
    penny: city.penny,
    bloggerIn: round2(city.bloggerIn),
    made: { ...st.made },
  };
}

/** Rebuild the city. Unknown or broken values fall back to their defaults. */
export function deserializeCity(raw: unknown): GameState {
  const st = createCityState();
  if (!raw || typeof raw !== "object") return st;
  const d = raw as Partial<CitySave>;
  const city = st.city!;
  st.money = num(d.money, st.money, 0);
  st.tutorial = Math.floor(num(d.tutorial, 0, 0, TUTORIAL_DONE));
  st.autoIncome.rate = num(d.autoRate, 0, 0);
  st.dayClock = num(d.dayClock, 0, 0);
  st.season = calendarSeason(st.dayClock);
  st.weather = currentWeather(st.dayClock);
  if (d.stats) for (const k of Object.keys(st.stats) as (keyof Stats)[]) st.stats[k] = num(d.stats[k], 0, 0);
  for (const id of ITEM_IDS) {
    const n = num(d.made?.[id], 0, 0);
    if (n > 0) st.made[id] = Math.floor(n);
  }
  for (const id of Object.keys(st.playerLevels) as (keyof typeof st.playerLevels)[]) {
    st.playerLevels[id] = Math.floor(num(d.playerLevels?.[id], st.playerLevels[id], 1, statMaxLevel(PLAYER_STATS[id])));
  }
  for (const id of Object.keys(st.workerLevels) as (keyof typeof st.workerLevels)[]) {
    st.workerLevels[id] = Math.floor(num(d.workerLevels?.[id], 1, 1, statMaxLevel(WORKER_STATS[id])));
  }
  const known = new Set(CITY_ZONES.map((z) => z.id));
  st.zones = new Set<ZoneId>(["c_lavka", ...(Array.isArray(d.zones) ? d.zones.filter((z) => known.has(z)) : [])]);

  for (const p of st.pads) {
    const s = d.pads?.[p.id];
    if (!s) continue;
    p.paid = num(s.paid, 0, 0);
    p.done = !!s.done && !p.def.repeatable;
  }

  // What stands in town follows from the pads that have been bought.
  const machineIds = new Set(st.machines.map((m) => m.id));
  const shelfIds = new Set<string>();
  const tableIds = new Set<string>();
  const deliveries = new Set<string>();
  for (const p of st.pads) {
    const e = p.def.effect;
    if (!p.done || e.type !== "city") continue;
    for (const id of e.machines) machineIds.add(id);
    for (const id of e.shelves) shelfIds.add(id);
    for (const id of e.tables) tableIds.add(id);
    if (e.delivery) deliveries.add(e.delivery);
  }

  city.shops = SHOPS.filter((s) => st.zones.has(s.zone)).map((def) => {
    const shop = createShop(def);
    const s = d.shops?.[def.id];
    shop.level = Math.floor(num(s?.level, 1, 1, SHOP_MAX_LEVEL));
    shop.ads = Math.floor(num(s?.ads, 1, 1, SHOP_MAX_LEVEL));
    shop.van.level = Math.floor(num(s?.van, 1, 1, VAN_MAX_LEVEL));
    shop.cash = num(s?.cash, 0, 0);
    shop.bundles = Math.floor(num(s?.bundles, 0, 0, 90));
    if (shop.cash > 0 && shop.bundles === 0) shop.bundles = 1;
    if (shop.bundles > 0 && shop.cash <= 0) shop.bundles = 0;
    shop.delivery = deliveries.has(def.id);
    return shop;
  });
  const shopOf = (id: string) => city.shops.find((s) => s.id === id);
  // The first counter is there from the start.
  shelfIds.add("shelf_lavka_bread");
  for (const id of shelfIds) {
    const def = shelfById(id);
    const shop = def && shopOf(def.shop);
    if (!shop) continue;
    const count = Math.floor(num(d.shops?.[def.shop]?.shelves?.[id], 0, 0, shelfCapacity(SHOP_MAX_LEVEL) * 2));
    shop.shelves.push(createShelf(def, false, count));
  }
  for (const id of tableIds) {
    const def = tableById(id);
    const shop = def && shopOf(def.shop);
    if (shop) shop.tables.push(createTable(def, false));
  }

  st.machines = [];
  for (const id of machineIds) {
    const def = machineById(id);
    if (!def) continue;
    const s = d.machines?.[id];
    const m = createMachine(def, false, Math.floor(num(s?.level, 1, 1, MACHINE_MAX_LEVEL)));
    if (s) {
      for (const inp of m.type.inputs) m.inputs[inp.item] = Math.floor(num(s.inputs?.[inp.item], 0, 0, 999));
      m.output = Math.floor(num(s.output, 0, 0, 999));
      if (typeof s.progress === "number") {
        m.working = true;
        m.progress = num(s.progress, 0, 0, 0.999);
      }
    }
    st.machines.push(m);
  }

  st.workers = [];
  for (const p of st.pads) {
    if (!p.done || p.def.effect.type !== "worker") continue;
    const def = p.def.effect.worker;
    const s = d.workers?.[def.id];
    const w = createWorker(def, num(s?.x, p.def.x), num(s?.z, p.def.z));
    w.stack = items(s?.stack);
    w.spawnT = 9;
    st.workers.push(w);
  }

  city.floors = Math.floor(num(d.floors, 0, 0, TOWER_FLOORS));
  city.finished = !!d.finished && city.floors >= TOWER_FLOORS;
  city.penny = num(d.penny, 0, 0);
  city.bloggerIn = num(d.bloggerIn, city.bloggerIn, 0, 3600);

  st.player.x = num(d.player?.x, st.player.x);
  st.player.z = num(d.player?.z, st.player.z);
  st.player.facing = num(d.player?.facing, st.player.facing);
  applyStats(st);
  st.player.stack = items(d.player?.stack).slice(0, st.player.capacity);
  return st;
}
