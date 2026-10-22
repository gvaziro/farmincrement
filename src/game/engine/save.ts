/**
 * Save format. Only what cannot be derived from layout + completed pads is
 * stored. Loading rebuilds the world from the layout and re-applies levels.
 */
import { MACHINE_MAX_LEVEL, MARKET_MAX_LEVEL, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY, PLAYER_STATS, TRUCK_MAX_LEVEL, WORKER_STATS, statMaxLevel } from "../data/balance";
import { ITEM_IDS, type ItemId } from "../data/items";
import { FIELDS, MACHINES, ZONES, type ZoneId } from "../data/layout";
import type { GameState, Order, Stats } from "./types";
import { TUTORIAL_DONE } from "./tutorial";
import { applyStats, createDepot, createField, createInitialState, createMachine, createTruck, createWorker } from "./world";

export const SAVE_KEY = "tiny-farm-empire/save";
export const SAVE_VERSION = 1;

export interface SaveData {
  v: number;
  savedAt: number;
  money: number;
  player: { x: number; z: number; facing: number; stack: ItemId[] };
  playerLevels: Record<string, number>;
  workerLevels: Record<string, number>;
  marketLevel: number;
  zones: ZoneId[];
  pads: Record<string, { paid: number; done: boolean }>;
  machines: Record<string, { level: number; inputs: Partial<Record<ItemId, number>>; output: number; progress?: number }>;
  workers: Record<string, { x: number; z: number; stack: ItemId[] }>;
  depot: { storage: ItemId[]; truckLevel: number } | null;
  statue: boolean;
  stats: Stats;
  tutorial: number;
  prestige: { stars: number; seasons: number };
  seasonEarned: number;
  autoRate: number;
  order?: { id: number; lines: { item: ItemId; need: number; have: number }[]; reward: number } | null;
}

export function serialize(st: GameState, now = Date.now()): SaveData {
  const pads: SaveData["pads"] = {};
  // Floor (never round up) so a nearly paid pad cannot load as overpaid.
  for (const p of st.pads) if (p.paid > 0 || p.done) pads[p.id] = { paid: Math.floor(p.paid * 100) / 100, done: p.done };
  const machines: SaveData["machines"] = {};
  for (const m of st.machines) {
    // A running cycle already consumed its inputs — keep its progress.
    machines[m.id] = { level: m.level, inputs: { ...m.inputs }, output: m.output, progress: m.working ? round2(m.progress) : undefined };
  }
  const workers: SaveData["workers"] = {};
  for (const w of st.workers) workers[w.id] = { x: round2(w.x), z: round2(w.z), stack: [...w.stack] };
  return {
    v: SAVE_VERSION,
    savedAt: now,
    money: round2(st.money),
    player: { x: round2(st.player.x), z: round2(st.player.z), facing: round2(st.player.facing), stack: [...st.player.stack] },
    playerLevels: { ...st.playerLevels },
    workerLevels: { ...st.workerLevels },
    marketLevel: st.marketLevel,
    zones: [...st.zones],
    pads,
    machines,
    workers,
    depot: st.depot ? { storage: depotStorage(st), truckLevel: st.depot.truckLevel } : null,
    statue: st.statue,
    stats: { ...st.stats },
    tutorial: st.tutorial,
    prestige: { ...st.prestige },
    seasonEarned: round2(st.seasonEarned),
    autoRate: st.autoIncome.rate,
    order: st.order ? { id: st.order.id, lines: st.order.lines.map((l) => ({ ...l })), reward: st.order.reward } : null,
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Goods already loaded into a truck that has not driven off (and so has not
 * paid) go back into storage — otherwise a reload would lose them.
 */
function depotStorage(st: GameState): ItemId[] {
  const d = st.depot!;
  const out = [...d.storage];
  for (const t of d.trucks) if (t.phase === "arrive" || t.phase === "load") out.push(...t.cargo);
  return out;
}
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const ITEM_SET = new Set<string>(ITEM_IDS);
const items = (v: unknown): ItemId[] => (Array.isArray(v) ? (v.filter((x) => ITEM_SET.has(x)) as ItemId[]) : []);

/** Rebuild a full GameState from save data. Unknown/corrupt values fall back to defaults. */
export function deserialize(raw: unknown): GameState {
  const d = migrate(raw);
  const st = createInitialState();
  if (!d) return st;

  st.money = num(d.money, 0, 0);
  st.tutorial = Math.floor(num(d.tutorial, 0, 0, TUTORIAL_DONE));
  st.statue = !!d.statue;
  st.seasonEarned = num(d.seasonEarned, 0, 0);
  st.autoIncome.rate = num(d.autoRate, 0, 0);
  st.order = readOrder(d.order);
  st.prestige = { stars: num(d.prestige?.stars, 0, 0), seasons: num(d.prestige?.seasons, 0, 0) };
  if (d.stats) for (const k of Object.keys(st.stats) as (keyof Stats)[]) st.stats[k] = num(d.stats[k], 0, 0);

  for (const id of Object.keys(st.playerLevels) as (keyof typeof st.playerLevels)[]) {
    st.playerLevels[id] = Math.floor(num(d.playerLevels?.[id], 1, 1, statMaxLevel(PLAYER_STATS[id])));
  }
  for (const id of Object.keys(st.workerLevels) as (keyof typeof st.workerLevels)[]) {
    st.workerLevels[id] = Math.floor(num(d.workerLevels?.[id], 1, 1, statMaxLevel(WORKER_STATS[id])));
  }
  st.marketLevel = Math.floor(num(d.marketLevel, 1, 1, MARKET_MAX_LEVEL));

  const knownZones = new Set(ZONES.map((z) => z.id));
  st.zones = new Set<ZoneId>(["farm", ...(Array.isArray(d.zones) ? d.zones.filter((z) => knownZones.has(z)) : [])]);

  for (const p of st.pads) {
    const s = d.pads?.[p.id];
    if (!s) continue;
    p.paid = num(s.paid, 0, 0);
    p.done = !!s.done && !p.def.repeatable;
  }
  const done = (id: string) => st.pads.find((p) => p.id === id)?.done ?? false;

  // Fields: starting field, zone freebies, bought plots.
  st.fields = [];
  for (const f of FIELDS) {
    const zone = ZONES.find((z) => z.id === f.zone)!;
    const owned = f.id === "wheat_1" || (st.zones.has(f.zone) && zone.includes.includes(f.id)) || done(`field_${f.id}`);
    if (owned) st.fields.push(createField(f, false));
  }

  st.machines = [];
  for (const m of MACHINES) {
    const owned = (m.cost === 0 && m.zone === "farm") || done(`build_${m.id}`);
    if (!owned) continue;
    const s = d.machines?.[m.id];
    const machine = createMachine(m, false, Math.floor(num(s?.level, 1, 1, MACHINE_MAX_LEVEL)));
    if (s) {
      for (const inp of machine.type.inputs) machine.inputs[inp.item] = Math.floor(num(s.inputs?.[inp.item], 0, 0, 999));
      machine.output = Math.floor(num(s.output, 0, 0, 999));
      if (typeof s.progress === "number") {
        machine.working = true;
        machine.progress = num(s.progress, 0, 0, 0.999);
      }
    }
    st.machines.push(machine);
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

  if (st.zones.has("depot")) {
    st.depot = createDepot();
    st.depot.storage = items(d.depot?.storage).slice(0, 400);
    st.depot.truckLevel = Math.floor(num(d.depot?.truckLevel, 1, 1, TRUCK_MAX_LEVEL));
    if (done("truck_2")) st.depot.trucks.push(createTruck(1));
  }

  st.player.x = num(d.player?.x, st.player.x);
  st.player.z = num(d.player?.z, st.player.z);
  st.player.facing = num(d.player?.facing, st.player.facing);
  applyStats(st);
  st.player.stack = items(d.player?.stack).slice(0, st.player.capacity);
  return st;
}

/** Upgrade older save formats here. Returns null for unusable data. */
function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<SaveData>;
  if (typeof d.v !== "number" || d.v > SAVE_VERSION) return null;
  return d as SaveData;
}

/** Money earned while the tab was closed. */
export function offlineEarnings(rate: number, seconds: number) {
  const s = Math.max(0, Math.min(seconds, OFFLINE_CAP_SECONDS));
  return { seconds: s, money: Math.floor(rate * s * OFFLINE_EFFICIENCY) };
}

function readOrder(v: unknown): Order | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { id?: unknown; lines?: unknown; reward?: unknown };
  if (!Array.isArray(o.lines)) return null;
  const lines = o.lines
    .filter((l): l is { item: ItemId; need: unknown; have: unknown } => !!l && typeof l === "object" && ITEM_SET.has((l as { item: string }).item))
    .map((l) => {
      const need = Math.floor(num(l.need, 1, 1, 999));
      return { item: l.item, need, have: Math.floor(num(l.have, 0, 0, need)) };
    });
  if (lines.length === 0) return null;
  return { id: Math.floor(num(o.id, 1, 1)), lines, reward: num(o.reward, 0, 0) };
}

/** Save written by a newer build — must not be overwritten by this one. */
export function isFutureSave(raw: unknown) {
  return !!raw && typeof raw === "object" && typeof (raw as { v?: unknown }).v === "number" && (raw as { v: number }).v > SAVE_VERSION;
}
