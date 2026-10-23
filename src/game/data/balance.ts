/**
 * All tunable numbers in one place. Pad prices live in layout.ts next to the
 * things they unlock; everything that scales with a level lives here.
 */

export interface LevelledStat {
  id: string;
  name: string;
  icon: string;
  /** Value at each level, index 0 = level 1. */
  values: readonly number[];
  /** Cost to go from level 1 → 2. */
  baseCost: number;
  /** Cost multiplier per level. */
  growth: number;
  unit?: string;
}

export const statValue = (s: LevelledStat, level: number) =>
  s.values[Math.min(level, s.values.length) - 1];
export const statMaxLevel = (s: LevelledStat) => s.values.length;
/** Price of the next level, or null if maxed. */
export const statCost = (s: LevelledStat, level: number) =>
  level >= s.values.length ? null : Math.round(s.baseCost * Math.pow(s.growth, level - 1));

const range = (start: number, step: number, count: number) =>
  Array.from({ length: count }, (_, i) => Math.round((start + step * i) * 100) / 100);

export const PLAYER_STATS = {
  capacity: {
    id: "capacity",
    name: "Вместимость",
    icon: "🎒",
    values: [10, 14, 18, 24, 30, 38, 46, 56, 68, 80, 100],
    baseCost: 20,
    growth: 2.0,
    unit: "шт",
  },
  speed: {
    id: "speed",
    name: "Скорость бега",
    icon: "👟",
    values: range(4.6, 0.4, 9),
    baseCost: 30,
    growth: 2.2,
    unit: "м/с",
  },
  reach: {
    id: "reach",
    name: "Радиус сбора",
    icon: "✋",
    values: range(1.0, 0.25, 7),
    baseCost: 40,
    growth: 2.4,
    unit: "м",
  },
} satisfies Record<string, LevelledStat>;

export type PlayerStatId = keyof typeof PLAYER_STATS;

export const WORKER_STATS = {
  speed: {
    id: "speed",
    name: "Скорость работников",
    icon: "🏃",
    values: range(3.0, 0.35, 10),
    baseCost: 150,
    growth: 2.1,
    unit: "м/с",
  },
  capacity: {
    id: "capacity",
    name: "Вместимость работников",
    icon: "🧺",
    values: range(6, 2, 10),
    baseCost: 200,
    growth: 2.1,
    unit: "шт",
  },
} satisfies Record<string, LevelledStat>;

export type WorkerStatId = keyof typeof WORKER_STATS;

// ── machines ────────────────────────────────────────────────────────────
export const MACHINE_MAX_LEVEL = 10;
export const machineSpeedMult = (level: number) => 1 + 0.35 * (level - 1);
export const machineCapacity = (level: number) => 20 + 10 * (level - 1);
/** Cost to upgrade a machine from `level` to `level + 1`. */
export const machineUpgradeCost = (baseCost: number, level: number) =>
  Math.round(baseCost * Math.pow(1.9, level - 1));
export const OPERATOR_BOOST = 1.5;
/** The player may stack a machine input this many times over its capacity. */
export const PLAYER_OVERFILL = 1.5;

// ── market & depot ──────────────────────────────────────────────────────
export const MARKET_MAX_LEVEL = 10;
export const marketPriceMult = (level: number) => 1 + 0.1 * (level - 1);
export const marketUpgradeCost = (level: number) => Math.round(250 * Math.pow(2.3, level - 1));

export const DEPOT_BONUS = 1.5;
export const DEPOT_STORAGE = 150;
export const TRUCK_MAX_LEVEL = 8;
export const truckCapacity = (level: number) => 25 + 15 * (level - 1);
export const truckUpgradeCost = (level: number) => Math.round(8000 * Math.pow(2.0, level - 1));
/** Seconds a truck spends driving away and back. */
export const TRUCK_TRIP_TIME = 14;

// ── interaction timings ─────────────────────────────────────────────────
/** Delay before a pad starts taking money (prevents accidental purchases). */
export const PAD_DELAY = 0.25;
/** Above this speed (m/s) the player is "passing by" and pads do not charge. */
export const PAD_MAX_SPEED = 1.2;
/** Seconds for a full pad payment regardless of price. */
export const PAD_FILL_TIME = 0.9;
export const PAD_TICK = 0.04;

/** Item transfer interval, accelerating the longer you stand in a zone. */
export const transferInterval = (timeInZone: number) => Math.max(0.035, 0.11 - timeInZone * 0.06);
export const WORKER_TRANSFER_INTERVAL = 0.14;

// ── market orders ───────────────────────────────────────────────────────
/** Bonus for a completed order, as a share of the order's sale value. */
export const ORDER_BONUS = 1.0;
/** Seconds between finishing an order and the next one appearing. */
export const ORDER_COOLDOWN = 8;
/** Bonus of a seasonal fair order (last day of each season). */
export const FAIR_BONUS = 2.0;

// ── meta ────────────────────────────────────────────────────────────────
export const OFFLINE_EFFICIENCY = 0.6;
export const OFFLINE_CAP_SECONDS = 2 * 60 * 60;
/** Stars for handing the farm over: a full first run (~$1.5B) gives ~38. */
export const PRESTIGE_DIVISOR = 1_000_000;
export const starsForEarnings = (earned: number) => Math.floor(Math.sqrt(earned / PRESTIGE_DIVISOR));
