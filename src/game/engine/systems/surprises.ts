/**
 * Little events "in between" the main loop: a golden plant to grab, a
 * travelling merchant to serve, a runaway animal to catch — and the foreman's
 * whistle. Events start once the tutorial is over and draw from their own
 * RNG, saved with the game, so tests can replay them.
 */
import { dist2, nextRandom } from "../../core/math";
import { MERCHANT_SPOTS, type ZoneId } from "../../data/layout";
import {
  GOLDEN_EVERY,
  GOLDEN_LIFE,
  GOLDEN_MONEY_CHANCE,
  GOLDEN_MONEY_SECONDS,
  GOLDEN_RUSH_CHANCE,
  MERCHANT_DRIVE,
  MERCHANT_EVERY,
  MERCHANT_WAIT,
  RUNAWAY_CATCH,
  RUNAWAY_EVERY,
  RUNAWAY_FLEE,
  RUNAWAY_HOMES,
  RUNAWAY_LIFE,
  RUNAWAY_MONEY_SECONDS,
  RUNAWAY_RANGE,
  RUNAWAY_SCARE,
  RUNAWAY_WANDER_SPEED,
  RUSH_TIME,
  WHISTLE_COOLDOWN,
  WHISTLE_MULT,
  WHISTLE_TIME,
} from "../../data/surprises";
import type { Game } from "../Game";
import { TUTORIAL_DONE } from "../tutorial";
import type { Field, GameState, GoldenReward, Machine, Plant, Runaway, RunawayKind, Surprises } from "../types";
import { baseActor, isLand } from "../world";
import { bearsFruit, reachBonus } from "./harvest";
import { moveActor } from "./movement";
import { availableProducts } from "./orders";

const pick = <T>(s: Surprises, list: readonly T[]) => list[Math.floor(nextRandom(s) * list.length)];
const pause = (s: Surprises, every: { min: number; spread: number }) => every.min + nextRandom(s) * every.spread;

export function updateSurprises(game: Game, dt: number) {
  const s = game.state.surprises;
  updateWhistle(game, dt);
  if (s.rush > 0) {
    s.rush -= dt;
    if (s.rush <= 0) {
      s.rush = 0;
      game.emit({ type: "rushEnd" });
    }
  }
  if (game.state.tutorial < TUTORIAL_DONE) return;
  updateGolden(game, dt);
  updateMerchant(game, dt);
  updateRunaway(game, dt);
}

/**
 * A money reward: `seconds` of the farm's automated income — but never less
 * than a good armful of its best goods, so it is worth it before the first hire.
 */
export function rewardMoney(game: Game, seconds: number) {
  const st = game.state;
  const best = availableProducts(game)[0];
  const armful = best ? game.sellValue(best) * Math.max(5, st.player.capacity) * 0.6 : 20;
  return Math.round(Math.max(st.autoIncome.rate * seconds, armful));
}

// ── golden plants ───────────────────────────────────────────────────────
/** The golden plant right now (with its field), if there is one. */
export function goldenPlant(st: GameState): { field: Field; plant: Plant } | null {
  const g = st.surprises.golden;
  if (!g) return null;
  const field = st.fields.find((f) => f.id === g.field);
  const plant = field?.plants[g.plant];
  return field && plant ? { field, plant } : null;
}

/** Workers leave the golden plant alone: only the farmer may pick it. */
export function isGolden(st: GameState, field: Field, plant: Plant) {
  const g = st.surprises.golden;
  return !!g && g.field === field.id && field.plants[g.plant] === plant;
}

function updateGolden(game: Game, dt: number) {
  const st = game.state;
  const s = st.surprises;
  if (!s.golden) {
    s.goldenIn -= dt;
    if (s.goldenIn <= 0) spawnGolden(game);
    return;
  }
  const gp = goldenPlant(st);
  if (!gp) {
    s.golden = null;
    s.goldenIn = pause(s, GOLDEN_EVERY);
    return;
  }
  const { field, plant } = gp;
  const p = st.player;
  const r = p.reach + reachBonus(field.crop);
  if (dist2(p.x, p.z, plant.x, plant.z) <= r * r) {
    collectGolden(game, plant);
    return;
  }
  s.golden.t -= dt;
  if (s.golden.t <= 0) {
    s.golden = null;
    s.goldenIn = pause(s, GOLDEN_EVERY);
    game.emit({ type: "golden", state: "fade", x: plant.x, z: plant.z });
  }
}

function spawnGolden(game: Game) {
  const st = game.state;
  const s = st.surprises;
  const fields = st.fields.filter((f) => f.spawnT > 3);
  if (fields.length === 0) {
    s.goldenIn = 20;
    return;
  }
  // Somewhere the farmer has to walk to — not right under their feet.
  let field = fields[0];
  let index = 0;
  for (let tries = 0; tries < 8; tries++) {
    field = pick(s, fields);
    index = Math.floor(nextRandom(s) * field.plants.length);
    const pl = field.plants[index];
    if (dist2(pl.x, pl.z, st.player.x, st.player.z) > 36) break;
  }
  const plant = field.plants[index];
  // Ripe at once, so it can be picked straight away.
  if (bearsFruit(field.crop)) plant.fruits = Math.max(plant.fruits, 1);
  else plant.growth = 1;
  plant.pop = 0;
  s.golden = { field: field.id, plant: index, t: GOLDEN_LIFE };
  game.emit({ type: "golden", state: "spawn", x: plant.x, z: plant.z });
}

function collectGolden(game: Game, plant: Plant) {
  const st = game.state;
  const s = st.surprises;
  s.golden = null;
  s.goldenIn = pause(s, GOLDEN_EVERY);
  st.stats.golden++;
  const roll = nextRandom(s);
  let reward: GoldenReward;
  let value: number;
  if (roll < GOLDEN_RUSH_CHANCE) {
    reward = "rush";
    s.rush = RUSH_TIME;
    value = RUSH_TIME;
  } else if (roll < GOLDEN_RUSH_CHANCE + GOLDEN_MONEY_CHANCE) {
    reward = "money";
    value = rewardMoney(game, GOLDEN_MONEY_SECONDS);
    game.earn(value, false);
  } else {
    reward = "bloom";
    value = bloom(game);
  }
  game.emit({ type: "golden", state: "collect", reward, value, x: plant.x, z: plant.z });
}

/** "Harvest boom": every field is ripe at once. Returns how many plants ripened. */
function bloom(game: Game) {
  let n = 0;
  for (const f of game.state.fields) {
    const max = f.crop.fruits ?? 0;
    for (const p of f.plants) {
      if (bearsFruit(f.crop) ? p.fruits >= max : p.growth >= 1) continue;
      if (bearsFruit(f.crop)) {
        p.fruits = max;
        p.timer = 0;
      } else p.growth = 1;
      p.pop = 0;
      n++;
    }
  }
  return n;
}

// ── the travelling merchant ─────────────────────────────────────────────
function updateMerchant(game: Game, dt: number) {
  const s = game.state.surprises;
  const m = s.merchant;
  if (!m) {
    s.merchantIn -= dt;
    if (s.merchantIn <= 0) spawnMerchant(game);
    return;
  }
  switch (m.phase) {
    case "arrive":
      m.anim = Math.min(1, m.anim + dt / MERCHANT_DRIVE);
      if (m.anim >= 1) m.phase = "wait";
      return;
    case "wait":
      m.t -= dt;
      if (m.t <= 0) {
        m.t = 0;
        m.phase = "leave";
        game.emit({ type: "merchant", state: "leave", x: m.x, z: m.z, item: m.item, need: m.need });
      }
      return;
    case "leave":
      m.anim -= dt / MERCHANT_DRIVE;
      if (m.anim <= 0) {
        s.merchant = null;
        s.merchantIn = pause(s, MERCHANT_EVERY);
        // The cart is gone: so are its collider and its hand-over spot.
        game.rebuild();
      }
      return;
  }
}

function spawnMerchant(game: Game) {
  const st = game.state;
  const s = st.surprises;
  const p = st.player;
  // Plots the farm owns, with room for the cart that is not under the farmer's feet.
  const zones = (Object.keys(MERCHANT_SPOTS) as ZoneId[]).filter((z) => {
    const spot = MERCHANT_SPOTS[z]!;
    return st.zones.has(z) && dist2(spot.x, spot.z, p.x, p.z) > 16;
  });
  // He wants something worth the trip: one of the farm's best goods.
  const goods = availableProducts(game).slice(0, 4);
  if (zones.length === 0 || goods.length === 0) {
    s.merchantIn = 30;
    return;
  }
  const zone = pick(s, zones);
  const spot = MERCHANT_SPOTS[zone]!;
  const item = pick(s, goods);
  const need = Math.max(4, Math.min(60, Math.round(p.capacity * (0.5 + nextRandom(s) * 0.3))));
  s.merchant = { zone, x: spot.x, z: spot.z, item, need, have: 0, earned: 0, t: MERCHANT_WAIT, phase: "arrive", anim: 0 };
  // The cart blocks its spot and opens a hand-over zone in front.
  game.rebuild();
  game.emit({ type: "merchant", state: "arrive", x: spot.x, z: spot.z, item, need });
}

// ── runaway animals ─────────────────────────────────────────────────────
function updateRunaway(game: Game, dt: number) {
  const st = game.state;
  const s = st.surprises;
  const r = s.runaway;
  if (!r) {
    s.runawayIn -= dt;
    if (s.runawayIn <= 0) spawnRunaway(game);
    return;
  }
  r.t -= dt;
  const p = st.player;
  const dx = r.x - p.x;
  const dz = r.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < RUNAWAY_CATCH) return catchRunaway(game, r);

  let vx = 0;
  let vz = 0;
  if (d < RUNAWAY_SCARE) {
    // Away from the farmer, zig-zagging — and a touch slower, so it can be caught.
    const speed = Math.max(RUNAWAY_WANDER_SPEED, p.speed * RUNAWAY_FLEE);
    const wobble = Math.sin(st.time * 5 + r.homeX) * 0.6;
    const c = Math.cos(wobble);
    const sn = Math.sin(wobble);
    const ux = dx / Math.max(d, 0.01);
    const uz = dz / Math.max(d, 0.01);
    vx = (ux * c - uz * sn) * speed;
    vz = (ux * sn + uz * c) * speed;
    r.pause = 0;
  } else if (r.t <= 0) {
    // Bored: trot back home.
    r.homing += dt;
    const hx = r.homeX - r.x;
    const hz = r.homeZ - r.z;
    const hd = Math.hypot(hx, hz);
    if (hd < 0.6 || r.homing > 25) {
      s.runaway = null;
      s.runawayIn = pause(s, RUNAWAY_EVERY);
      game.emit({ type: "runaway", state: "home", kind: r.kind, x: r.x, z: r.z });
      return;
    }
    vx = (hx / hd) * RUNAWAY_WANDER_SPEED * 1.4;
    vz = (hz / hd) * RUNAWAY_WANDER_SPEED * 1.4;
  } else if (r.pause > 0) {
    r.pause -= dt;
  } else {
    const tx = r.tx - r.x;
    const tz = r.tz - r.z;
    const td = Math.hypot(tx, tz);
    if (td < 0.3) {
      r.pause = 0.6 + nextRandom(s) * 1.8;
      wanderTarget(game, r);
    } else {
      vx = (tx / td) * RUNAWAY_WANDER_SPEED;
      vz = (tz / td) * RUNAWAY_WANDER_SPEED;
    }
  }
  const bx = r.x;
  const bz = r.z;
  moveActor(game, r, vx, vz, dt);
  // Walked into a wall while wandering (for a moment — it takes a few frames
  // to get going, more of them on a fast screen): go somewhere else.
  const wandering = d >= RUNAWAY_SCARE && r.t > 0 && (vx || vz);
  if (wandering && Math.hypot(r.x - bx, r.z - bz) < RUNAWAY_WANDER_SPEED * dt * 0.2) {
    r.stuck += dt;
    if (r.stuck > 0.4) {
      r.stuck = 0;
      wanderTarget(game, r);
    }
  } else r.stuck = 0;
}

/** A free spot on the farm near its pen. */
function wanderTarget(game: Game, r: Runaway) {
  const st = game.state;
  const s = st.surprises;
  for (let tries = 0; tries < 8; tries++) {
    const a = nextRandom(s) * Math.PI * 2;
    const k = 1.5 + nextRandom(s) * (RUNAWAY_RANGE - 1.5);
    const x = r.homeX + Math.sin(a) * k;
    const z = r.homeZ + Math.cos(a) * k;
    if (!isLand(st, x, z, 0.5)) continue;
    if (st.obstacles.some((o) => Math.abs(x - o.x) < o.hw + 0.5 && Math.abs(z - o.z) < o.hd + 0.5)) continue;
    r.tx = x;
    r.tz = z;
    return;
  }
  r.tx = r.homeX;
  r.tz = r.homeZ;
}

/** Pens that exist right now. */
const openPens = (game: Game) => (Object.keys(RUNAWAY_HOMES) as RunawayKind[]).filter((k) => game.machine(RUNAWAY_HOMES[k]));

export const isRunawayKind = (v: unknown): v is RunawayKind => typeof v === "string" && v in RUNAWAY_HOMES;

/** The runaway itself: an actor without a stack, out of its pen (a machine). */
export function createRunaway(kind: RunawayKind, pen: Machine, x?: number, z?: number): Runaway {
  // It slips out by the gate, where goods are picked up.
  const homeX = pen.outRect.x;
  const homeZ = pen.outRect.z;
  return {
    ...baseActor("runaway", x ?? homeX, z ?? homeZ),
    kind,
    homeX,
    homeZ,
    tx: homeX,
    tz: homeZ,
    pause: 0.4,
    t: RUNAWAY_LIFE,
    homing: 0,
    stuck: 0,
    capacity: 0,
  };
}

function spawnRunaway(game: Game) {
  const st = game.state;
  const s = st.surprises;
  // Not from a gate the farmer is standing at: that would be a catch for free.
  const kinds = openPens(game).filter((k) => {
    const gate = game.machine(RUNAWAY_HOMES[k])!.outRect;
    return dist2(gate.x, gate.z, st.player.x, st.player.z) > (RUNAWAY_SCARE + 1) ** 2;
  });
  if (kinds.length === 0) {
    s.runawayIn = openPens(game).length > 0 ? 15 : 60;
    return;
  }
  const kind = pick(s, kinds);
  const r = createRunaway(kind, game.machine(RUNAWAY_HOMES[kind])!);
  wanderTarget(game, r);
  s.runaway = r;
  game.emit({ type: "runaway", state: "escape", kind: r.kind, x: r.x, z: r.z });
}

function catchRunaway(game: Game, r: Runaway) {
  const st = game.state;
  const s = st.surprises;
  s.runaway = null;
  s.runawayIn = pause(s, RUNAWAY_EVERY);
  st.stats.caught++;
  const value = rewardMoney(game, RUNAWAY_MONEY_SECONDS);
  game.earn(value, false);
  game.emit({ type: "runaway", state: "caught", kind: r.kind, x: r.x, z: r.z, value });
}

// ── the foreman's whistle ───────────────────────────────────────────────
function updateWhistle(game: Game, dt: number) {
  const s = game.state.surprises;
  if (s.whistleCd > 0) s.whistleCd = Math.max(0, s.whistleCd - dt);
  if (s.whistle > 0) {
    s.whistle -= dt;
    if (s.whistle <= 0) {
      s.whistle = 0;
      game.emit({ type: "whistle", state: "end" });
    }
  }
}

/** The whistle needs someone to whistle at, and a breath between blows. */
export const canWhistle = (st: GameState) => st.workers.length > 0 && st.surprises.whistleCd <= 0;

export function blowWhistle(game: Game) {
  const st = game.state;
  if (!canWhistle(st)) return false;
  st.surprises.whistle = WHISTLE_TIME;
  st.surprises.whistleCd = WHISTLE_COOLDOWN;
  st.stats.whistles++;
  game.emit({ type: "whistle", state: "start" });
  return true;
}

/** Workers' speed multiplier: they run while the whistle sounds. */
export const workerBoost = (st: GameState) => (st.surprises.whistle > 0 ? WHISTLE_MULT : 1);

// ── for the renderers and the HUD ───────────────────────────────────────
export interface SurpriseTarget {
  kind: "golden" | "merchant" | "runaway";
  x: number;
  z: number;
  icon: string;
}

const RUNAWAY_ICONS: Record<RunawayKind, string> = { chicken: "🐔", cow: "🐄", sheep: "🐑" };

/** Where something is waiting for the farmer (for the arrows at the screen edge). */
export function surpriseTargets(st: GameState): SurpriseTarget[] {
  const out: SurpriseTarget[] = [];
  const gp = goldenPlant(st);
  if (gp) out.push({ kind: "golden", x: gp.plant.x, z: gp.plant.z, icon: "✨" });
  const m = st.surprises.merchant;
  if (m && m.phase !== "leave") out.push({ kind: "merchant", x: m.x, z: m.z, icon: "🛒" });
  const r = st.surprises.runaway;
  if (r) out.push({ kind: "runaway", x: r.x, z: r.z, icon: RUNAWAY_ICONS[r.kind] });
  return out;
}
