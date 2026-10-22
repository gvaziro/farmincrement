/** Factories for runtime entities + derived world data (zones, colliders). */
import { hashString, mulberry32, rect, type Rect } from "../core/math";
import { PLAYER_STATS, statValue, WORKER_STATS } from "../data/balance";
import { CROPS } from "../data/crops";
import {
  DEPOT,
  FARMHOUSE,
  FIELDS,
  INITIAL_MACHINES,
  MARKET,
  WATER_RECTS,
  standPoint,
  PADS,
  PLAYER_SPAWN,
  STATUE,
  TRASH,
  ZONE_D,
  ZONE_W,
  ZONES,
  machineById,
  type FieldDef,
  type MachineDef,
  type WorkerDef,
  type ZoneId,
} from "../data/layout";
import { MACHINE_TYPES } from "../data/machines";
import type {
  Actor,
  Depot,
  Field,
  GameState,
  InteractZone,
  Machine,
  PadState,
  Player,
  Truck,
  Worker,
} from "./types";

function baseActor(id: string, x: number, z: number): Actor {
  return {
    id,
    x,
    z,
    vx: 0,
    vz: 0,
    facing: 0,
    stack: [],
    incoming: 0,
    capacity: 10,
    speed: 4,
    moving: false,
    walk: 0,
    zoneId: null,
    zoneTime: 0,
    transferCd: 0,
    lean: { x: 0, z: 0, vx: 0, vz: 0 },
    fullT: 99,
  };
}

export function createPlayer(): Player {
  return { ...baseActor("player", PLAYER_SPAWN.x, PLAYER_SPAWN.z), reach: 1, facing: Math.PI * 0.75 };
}

export function createWorker(def: WorkerDef, x: number, z: number): Worker {
  const rnd = mulberry32(hashString(def.id));
  return {
    ...baseActor(def.id, x, z),
    def,
    reach: 0.85,
    phase: "spawn",
    path: [],
    pathIdx: 0,
    targetZone: null,
    wait: 0,
    stuck: 0,
    repath: 0,
    spawnT: 0,
    jitter: { x: (rnd() - 0.5) * 0.9, z: (rnd() - 0.5) * 0.7 },
    harvestTarget: null,
  };
}

export function createField(def: FieldDef, fresh: boolean): Field {
  const crop = CROPS[def.crop];
  const rnd = mulberry32(hashString(def.id));
  const s = crop.spacing;
  const rs = def.rowSpacing ?? s;
  const plants = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let r = 0; r < def.rows; r++) {
    for (let c = 0; c < def.cols; c++) {
      const jitter = crop.kind === "tree" ? 0.25 : crop.kind === "water" ? 0 : 0.12;
      const x = def.x + (c - (def.cols - 1) / 2) * s + (rnd() - 0.5) * jitter;
      const z = def.z + (r - (def.rows - 1) / 2) * rs + (rnd() - 0.5) * jitter;
      const seed = rnd();
      const stand = standPoint(def, x, z);
      plants.push({
        x,
        z,
        sx: stand.x,
        sz: stand.z,
        growth: fresh ? 0.05 + seed * 0.25 : 1,
        fruits: fresh ? 0 : (crop.fruits ?? 0),
        timer: fresh ? seed * crop.growTime : 0,
        pop: 9,
        seed,
      });
      minX = Math.min(minX, x, stand.x);
      maxX = Math.max(maxX, x, stand.x);
      minZ = Math.min(minZ, z, stand.z);
      maxZ = Math.max(maxZ, z, stand.z);
    }
  }
  // The rect covers the spots and where you stand to reach them.
  const pad = crop.kind === "water" ? 0.6 : s / 2 + 0.3;
  const fr = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hw: (maxX - minX) / 2 + pad, hd: (maxZ - minZ) / 2 + pad };
  return { id: def.id, def, crop, plants, rect: fr, spawnT: fresh ? 0 : 9 };
}

export function createMachine(def: MachineDef, fresh: boolean, level = 1): Machine {
  const type = MACHINE_TYPES[def.type];
  const [w, d] = type.size;
  const zr = (b: readonly [number, number, number, number]) => rect(def.x + b[0], def.z + b[1], b[2], b[3]);
  return {
    id: def.id,
    def,
    type,
    level,
    inputs: {},
    output: 0,
    progress: 0,
    working: false,
    operator: false,
    incomingIn: {},
    incomingOut: 0,
    body: rect(def.x, def.z, w, d),
    inRect: zr(type.inZone),
    outRect: zr(type.outZone),
    spawnT: fresh ? 0 : 9,
    pulse: 0,
    produced: 0,
    idle: null,
  };
}

export function createTruck(index: number): Truck {
  return {
    id: `truck_${index}`,
    phase: "away",
    t: 2 + index * 6,
    x: 60,
    z: DEPOT.roadZ,
    cargo: [],
    incoming: 0,
    wait: 0,
    loadCd: 0,
  };
}

export function createDepot(): Depot {
  return { storage: [], incoming: 0, truckLevel: 1, trucks: [createTruck(0)] };
}

export function createPads(): PadState[] {
  return PADS.map((def) => ({ id: def.id, def, paid: 0, level: 1, done: false, visible: false, appearT: 0 }));
}

export function createInitialState(): GameState {
  const player = createPlayer();
  const state: GameState = {
    time: 0,
    money: 0,
    player,
    playerLevels: { capacity: 1, speed: 1, reach: 1 },
    workerLevels: { speed: 1, capacity: 1 },
    marketLevel: 1,
    zones: new Set<ZoneId>(["farm"]),
    fields: FIELDS.filter((f) => f.id === "wheat_1").map((f) => createField(f, false)),
    machines: INITIAL_MACHINES.map((id) => createMachine(machineById(id), false)),
    workers: [],
    pads: createPads(),
    depot: null,
    statue: false,
    flights: [],
    interact: [],
    obstacles: [],
    stats: { earned: 0, harvested: 0, sold: 0, produced: 0, purchases: 0, playTime: 0, orders: 0 },
    tutorial: 0,
    prestige: { stars: 0, seasons: 0 },
    seasonEarned: 0,
    autoIncome: { acc: 0, window: 0, rate: 0 },
    order: null,
    orderCooldown: 6,
    structure: 0,
  };
  applyStats(state);
  return state;
}

/** Push upgrade levels into actor stats. */
export function applyStats(state: GameState) {
  const p = state.player;
  p.capacity = statValue(PLAYER_STATS.capacity, state.playerLevels.capacity);
  p.speed = statValue(PLAYER_STATS.speed, state.playerLevels.speed);
  p.reach = statValue(PLAYER_STATS.reach, state.playerLevels.reach);
  const ws = statValue(WORKER_STATS.speed, state.workerLevels.speed);
  const wc = statValue(WORKER_STATS.capacity, state.workerLevels.capacity);
  for (const w of state.workers) {
    w.speed = ws * (0.95 + (hashString(w.id) % 10) / 100);
    w.capacity = w.def.job.kind === "operator" ? 0 : wc;
  }
}

// ── land ────────────────────────────────────────────────────────────────
export const zoneAt = (x: number, z: number) => ({ gx: Math.round(x / ZONE_W), gz: Math.round(z / ZONE_D) });

const zoneKey = (gx: number, gz: number) => `${gx},${gz}`;
const ZONE_BY_GRID = new Map(ZONES.map((z) => [zoneKey(z.gx, z.gz), z.id]));

export function zoneIdAt(x: number, z: number): ZoneId | undefined {
  const g = zoneAt(x, z);
  return ZONE_BY_GRID.get(zoneKey(g.gx, g.gz));
}

/** True when a circle of radius r at (x,z) is fully on unlocked land. */
export function isLand(state: GameState, x: number, z: number, r: number) {
  for (let i = 0; i < 4; i++) {
    const px = x + (i & 1 ? r : -r);
    const pz = z + (i & 2 ? r : -r);
    const id = zoneIdAt(px, pz);
    if (!id || !state.zones.has(id)) return false;
  }
  return true;
}

// ── derived world data ──────────────────────────────────────────────────
export function buildObstacles(state: GameState): Rect[] {
  const obs: Rect[] = state.machines.map((m) => m.body);
  obs.push(rect(MARKET.x, MARKET.z, MARKET.w, MARKET.d));
  obs.push(rect(FARMHOUSE.x, FARMHOUSE.z, FARMHOUSE.w, FARMHOUSE.d));
  if (state.depot) obs.push(rect(DEPOT.x, DEPOT.z, DEPOT.w, DEPOT.d));
  if (state.statue) obs.push(rect(STATUE.x, STATUE.z, STATUE.w, STATUE.d));
  // The pond is always there; it only matters once its plot is open.
  obs.push(...WATER_RECTS);
  return obs;
}

export function buildInteractZones(state: GameState): InteractZone[] {
  const zones: InteractZone[] = [];
  for (const m of state.machines) {
    zones.push({ id: `in:${m.id}`, kind: "machineIn", ref: m.id, rect: m.inRect });
    zones.push({ id: `out:${m.id}`, kind: "machineOut", ref: m.id, rect: m.outRect });
  }
  zones.push({ id: "market", kind: "market", ref: "market", rect: rect(MARKET.sell.x, MARKET.sell.z, MARKET.sell.w, MARKET.sell.d) });
  zones.push({ id: "farmhouse", kind: "farmhouse", ref: "farmhouse", rect: rect(FARMHOUSE.door.x, FARMHOUSE.door.z, FARMHOUSE.door.w, FARMHOUSE.door.d) });
  zones.push({ id: "trash", kind: "trash", ref: "trash", rect: rect(TRASH.x, TRASH.z, TRASH.w, TRASH.d) });
  if (state.depot) {
    zones.push({ id: "depot", kind: "depot", ref: "depot", rect: rect(DEPOT.input.x, DEPOT.input.z, DEPOT.input.w, DEPOT.input.d) });
  }
  for (const p of state.pads) {
    if (!p.visible) continue;
    zones.push({ id: `pad:${p.id}`, kind: "pad", ref: p.id, rect: rect(p.def.x, p.def.z, p.def.size, p.def.size) });
  }
  return zones;
}
