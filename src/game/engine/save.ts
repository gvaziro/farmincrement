/**
 * Save format. Only what cannot be derived from layout + completed pads is
 * stored. Loading rebuilds the world from the layout and re-applies levels.
 */
import { MACHINE_MAX_LEVEL, MARKET_MAX_LEVEL, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY, PLAYER_STATS, TRUCK_MAX_LEVEL, WORKER_STATS, statMaxLevel } from "../data/balance";
import { isChallengeId, type ChallengeId } from "../data/challenges";
import { ALL_FINDS } from "../data/finds";
import { isHatId } from "../data/hats";
import { HOLIDAY_EFFICIENCY_PER_LEVEL, HOLIDAY_HOURS_PER_LEVEL, PERKS, VOICE_TIME_PER_LEVEL, isPerkId } from "../data/legacy";
import { ITEM_IDS, isSellable, type ItemId } from "../data/items";
import { ACHIEVEMENTS, unlockedHats } from "./achievements";
import { FIELDS, MACHINES, MERCHANT_SPOTS, ZONES, type ZoneId } from "../data/layout";
import { GOLDEN_LIFE, MERCHANT_EVERY, MERCHANT_WAIT, RUNAWAY_HOMES, RUNAWAY_LIFE, RUSH_TIME, WHISTLE_COOLDOWN, WHISTLE_TIME } from "../data/surprises";
import { createRunaway, isRunawayKind } from "./systems/surprises";
import { frozenSeason } from "./challenges";
import { calendarSeason } from "./seasons";
import { currentWeather } from "./weather";
import type { ChronicleEntry, GameState, Order, Stats } from "./types";
import { TUTORIAL_DONE } from "./tutorial";
import { applyStats, createDepot, createField, createInitialState, createMachine, createSurprises, createTruck, createWorker, isLand } from "./world";

export const SAVE_KEY = "tiny-farm-empire/save";
/** v2: prestige "seasons" became "generations" (seasons are the calendar now). */
export const SAVE_VERSION = 2;

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
  prestige: { stars: number; generations: number; totalStars?: number };
  runEarned: number;
  legacy?: Partial<Record<string, number>>;
  autoRate: number;
  order?: { id: number; lines: { item: ItemId; need: number; have: number }[]; reward: number; fair?: boolean } | null;
  lastFair?: number;
  dayClock?: number;
  achievements?: string[];
  hat?: string;
  made?: Partial<Record<string, number>>;
  album?: string[];
  surprises?: SavedSurprises;
  challenges?: string[];
  genTimes?: Partial<Record<string, number>>;
  records?: Partial<Record<string, number>>;
  chronicle?: ChronicleEntry[];
}

/** Event timers and whatever event is going on (a leaving cart counts as gone). */
interface SavedSurprises {
  seed: number;
  goldenIn: number;
  golden: { field: string; plant: number; t: number } | null;
  rush: number;
  merchantIn: number;
  merchant: { zone: string; item: string; need: number; have: number; earned: number; t: number } | null;
  runawayIn: number;
  runaway: { kind: string; x: number; z: number; t: number } | null;
  whistle: number;
  whistleCd: number;
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
    legacy: { ...st.legacy },
    runEarned: round2(st.runEarned),
    autoRate: st.autoIncome.rate,
    order: st.order ? { id: st.order.id, lines: st.order.lines.map((l) => ({ ...l })), reward: st.order.reward, fair: st.order.fair || undefined } : null,
    lastFair: st.lastFair,
    achievements: [...st.achievements],
    hat: st.hat,
    made: { ...st.made },
    album: [...st.album],
    surprises: saveSurprises(st),
    challenges: [...st.challenges],
    genTimes: { ...st.genTimes },
    records: { ...st.records },
    chronicle: st.chronicle.map((c) => ({ ...c, challenges: [...c.challenges] })),
    // Floor: rounding up could push a save into the next season.
    dayClock: Math.floor(st.dayClock * 100) / 100,
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function saveSurprises(st: GameState): SavedSurprises {
  const s = st.surprises;
  const m = s.merchant && s.merchant.phase !== "leave" ? s.merchant : null;
  const r = s.runaway;
  return {
    seed: s.seed,
    goldenIn: round2(s.goldenIn),
    golden: s.golden ? { ...s.golden, t: round2(s.golden.t) } : null,
    rush: round2(s.rush),
    // A cart already rolling away would otherwise be back at once.
    merchantIn: s.merchant && !m ? MERCHANT_EVERY.min : round2(s.merchantIn),
    merchant: m ? { zone: m.zone, item: m.item, need: m.need, have: m.have, earned: round2(m.earned), t: round2(m.t) } : null,
    runawayIn: round2(s.runawayIn),
    runaway: r ? { kind: r.kind, x: round2(r.x), z: round2(r.z), t: round2(r.t) } : null,
    whistle: round2(s.whistle),
    whistleCd: round2(s.whistleCd),
  };
}

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
  st.runEarned = num(d.runEarned, 0, 0);
  st.autoIncome.rate = num(d.autoRate, 0, 0);
  st.order = readOrder(d.order);
  st.lastFair = Math.floor(num(d.lastFair, -1, -1));
  for (const id of ITEM_IDS) {
    const n = num(d.made?.[id], 0, 0);
    if (n > 0) st.made[id] = Math.floor(n);
  }
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  st.achievements = new Set(Array.isArray(d.achievements) ? d.achievements.filter((id) => known.has(id)) : []);
  st.hat = isHatId(d.hat) && unlockedHats(st.achievements).includes(d.hat) ? d.hat : "straw";
  const finds = new Set(ALL_FINDS);
  st.album = new Set(Array.isArray(d.album) ? d.album.filter((id) => finds.has(id)) : []);
  st.dayClock = num(d.dayClock, 0, 0);
  st.challenges = readChallenges(d.challenges);
  st.season = calendarSeason(st.dayClock, frozenSeason(st));
  st.weather = currentWeather(st.dayClock, frozenSeason(st));
  st.genTimes = readTimes(d.genTimes);
  st.records = readTimes(d.records);
  st.chronicle = Array.isArray(d.chronicle) ? d.chronicle.slice(-60).flatMap(readChronicleEntry) : [];
  const stars = Math.floor(num(d.prestige?.stars, 0, 0));
  // Saves from before the legacy shop: the stars they had become shop money.
  st.prestige = { stars, totalStars: Math.floor(num(d.prestige?.totalStars, stars, stars)), generations: num(d.prestige?.generations, 0, 0) };
  st.legacy = {};
  for (const [id, level] of Object.entries(d.legacy ?? {})) {
    if (isPerkId(id)) st.legacy[id] = Math.floor(num(level, 0, 0, PERKS[id].max));
  }
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
  readSurprises(st, d.surprises);
  return st;
}

const RECORD_KEYS = new Set<string>([...ZONES.map((z) => z.id), "statue"]);

const readChallenges = (v: unknown): ChallengeId[] => (Array.isArray(v) ? [...new Set(v.filter(isChallengeId))] : []);

/** Times of plots and the statue (seconds); anything else is dropped. */
function readTimes(v: unknown): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, t] of Object.entries(v)) {
    if (RECORD_KEYS.has(k) && typeof t === "number" && Number.isFinite(t) && t >= 0) out[k] = t;
  }
  return out;
}

function readChronicleEntry(v: unknown): ChronicleEntry[] {
  if (!v || typeof v !== "object") return [];
  const c = v as Partial<Record<keyof ChronicleEntry, unknown>>;
  return [
    {
      gen: Math.floor(num(c.gen, 1, 1)),
      statue: num(c.statue, 0, 0),
      played: num(c.played, 0, 0),
      stars: Math.floor(num(c.stars, 0, 0)),
      challenges: readChallenges(c.challenges),
    },
  ];
}

/** Events come back only where they still make sense (the field, plot or pen is there). */
function readSurprises(st: GameState, v: unknown) {
  const s = createSurprises();
  st.surprises = s;
  if (!v || typeof v !== "object") return;
  const d = v as Partial<Record<keyof SavedSurprises, unknown>>;
  s.seed = Math.floor(num(d.seed, s.seed, 0, 0xffffffff)) >>> 0;
  s.goldenIn = num(d.goldenIn, s.goldenIn, 0, 3600);
  s.rush = num(d.rush, 0, 0, RUSH_TIME);
  s.merchantIn = num(d.merchantIn, s.merchantIn, 0, 3600);
  s.runawayIn = num(d.runawayIn, s.runawayIn, 0, 3600);
  // "Зычный голос" makes the whistle sound longer.
  s.whistle = num(d.whistle, 0, 0, WHISTLE_TIME + PERKS.voice.max * VOICE_TIME_PER_LEVEL);
  s.whistleCd = num(d.whistleCd, 0, 0, WHISTLE_COOLDOWN);

  const g = d.golden as Partial<SavedSurprises["golden"] & object> | null | undefined;
  const field = g && typeof g === "object" ? st.fields.find((f) => f.id === g.field) : undefined;
  const plant = Math.floor(num(g?.plant, -1));
  if (field && plant >= 0 && plant < field.plants.length) s.golden = { field: field.id, plant, t: num(g?.t, GOLDEN_LIFE, 0, GOLDEN_LIFE) };

  const m = d.merchant as Partial<SavedSurprises["merchant"] & object> | null | undefined;
  const zone = m && typeof m === "object" ? (m.zone as ZoneId) : undefined;
  const spot = zone ? MERCHANT_SPOTS[zone] : undefined;
  if (m && zone && spot && st.zones.has(zone) && ITEM_SET.has(m.item as string) && isSellable(m.item as ItemId)) {
    const need = Math.floor(num(m.need, 1, 1, 999));
    const have = Math.floor(num(m.have, 0, 0, need - 1));
    s.merchant = { zone, x: spot.x, z: spot.z, item: m.item as ItemId, need, have, earned: num(m.earned, 0, 0), t: num(m.t, MERCHANT_WAIT, 0, MERCHANT_WAIT), phase: "wait", anim: 1 };
  }

  const r = d.runaway as Partial<SavedSurprises["runaway"] & object> | null | undefined;
  const pen = r && typeof r === "object" && isRunawayKind(r.kind) ? st.machines.find((x) => x.id === RUNAWAY_HOMES[r.kind as keyof typeof RUNAWAY_HOMES]) : undefined;
  if (r && pen && isRunawayKind(r.kind)) {
    const x = num(r.x, NaN);
    const z = num(r.z, NaN);
    const runaway = isLand(st, x, z, 0.4) ? createRunaway(r.kind, pen, x, z) : createRunaway(r.kind, pen);
    runaway.t = num(r.t, RUNAWAY_LIFE, 0, RUNAWAY_LIFE);
    s.runaway = runaway;
  }
}

/** Upgrade older save formats here. Returns null for unusable data. */
function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = { ...(raw as Record<string, unknown>) };
  if (typeof d.v !== "number" || d.v > SAVE_VERSION) return null;
  if (d.v < 2) {
    // v1 called a prestige run a "season".
    const old = d as { seasonEarned?: unknown; prestige?: { stars?: unknown; seasons?: unknown } };
    d.runEarned = old.seasonEarned;
    d.prestige = old.prestige && typeof old.prestige === "object" ? { stars: old.prestige.stars, generations: old.prestige.seasons } : undefined;
    delete d.seasonEarned;
    d.v = 2;
  }
  return d as unknown as SaveData;
}

/** Money earned while the tab was closed ("long holiday" raises the cap and the share). */
export function offlineEarnings(rate: number, seconds: number, holiday = 0) {
  const cap = OFFLINE_CAP_SECONDS + holiday * HOLIDAY_HOURS_PER_LEVEL * 3600;
  const s = Math.max(0, Math.min(seconds, cap));
  return { seconds: s, money: Math.floor(rate * s * (OFFLINE_EFFICIENCY + holiday * HOLIDAY_EFFICIENCY_PER_LEVEL)) };
}

function readOrder(v: unknown): Order | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { id?: unknown; lines?: unknown; reward?: unknown; fair?: unknown };
  if (!Array.isArray(o.lines)) return null;
  const lines = o.lines
    .filter((l): l is { item: ItemId; need: unknown; have: unknown } => !!l && typeof l === "object" && ITEM_SET.has((l as { item: string }).item))
    .map((l) => {
      const need = Math.floor(num(l.need, 1, 1, 999));
      return { item: l.item, need, have: Math.floor(num(l.have, 0, 0, need)) };
    });
  if (lines.length === 0) return null;
  return { id: Math.floor(num(o.id, 1, 1)), lines, reward: num(o.reward, 0, 0), fair: o.fair === true || undefined };
}

/** Save written by a newer build — must not be overwritten by this one. */
export function isFutureSave(raw: unknown) {
  return !!raw && typeof raw === "object" && typeof (raw as { v?: unknown }).v === "number" && (raw as { v: number }).v > SAVE_VERSION;
}

/** What a save holds, in a few numbers — for import previews and the backup list. */
export interface SaveSummary {
  savedAt: number;
  money: number;
  zones: number;
  generations: number;
  stars: number;
  playTime: number;
}

/** Summary of raw save data (or null if it is not a save at all). */
export function saveSummary(raw: unknown): SaveSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<SaveData> & { prestige?: { stars?: unknown; generations?: unknown; seasons?: unknown } };
  if (typeof d.v !== "number") return null;
  return {
    savedAt: num(d.savedAt, 0, 0),
    money: num(d.money, 0, 0),
    zones: Array.isArray(d.zones) ? new Set(["farm", ...d.zones]).size : 1,
    // v1 saves called generations "seasons".
    generations: num(d.prestige?.generations ?? d.prestige?.seasons, 0, 0),
    stars: num(d.prestige?.stars, 0, 0),
    playTime: num(d.stats?.playTime, 0, 0),
  };
}
