/**
 * The calendar: a year of four seasons, DAYS_PER_SEASON days each. Like the
 * day/night cycle it runs on `dayClock`, so it is saved for free. A season
 * changes at midnight, while everyone sleeps. Seasons only ever give bonuses
 * (a perk + goods in demand) — never penalties.
 */
import type { CropDef } from "../data/crops";
import type { ItemId } from "../data/items";
import { DAY_LENGTH, DAY_START } from "./daycycle";

export const DAYS_PER_SEASON = 2;
export const SEASON_LENGTH = DAYS_PER_SEASON * DAY_LENGTH;

export type SeasonId = "spring" | "summer" | "autumn" | "winter";
export const SEASON_ORDER: readonly SeasonId[] = ["spring", "summer", "autumn", "winter"];

export interface SeasonDef {
  id: SeasonId;
  name: string;
  /** "весны", "лета"… — for "до весны" style phrases. */
  genitive: string;
  /** "Пришла весна", "Наступило лето"… */
  arrival: string;
  icon: string;
  /** The season's bonus, as shown to the player. */
  perk: string;
  /** Goods that sell for DEMAND_MULT more this season. */
  demand: readonly ItemId[];
}

export const SEASONS: Record<SeasonId, SeasonDef> = {
  spring: { id: "spring", name: "Весна", genitive: "весны", arrival: "Пришла весна", icon: "🌸", perk: "посадки растут на 25% быстрее", demand: ["egg", "honey", "jam"] },
  summer: { id: "summer", name: "Лето", genitive: "лета", arrival: "Наступило лето", icon: "☀️", perk: "работники бегают на 15% быстрее", demand: ["juice", "milk", "icecream"] },
  autumn: { id: "autumn", name: "Осень", genitive: "осени", arrival: "Пришла осень", icon: "🍂", perk: "каждый 4-й сбор — двойной", demand: ["sauce", "cheese", "pie"] },
  winter: { id: "winter", name: "Зима", genitive: "зимы", arrival: "Пришла зима", icon: "❄️", perk: "машины работают на 20% быстрее", demand: ["bread", "canned", "sweater"] },
};

export const DEMAND_MULT = 1.5;
export const SPRING_GROWTH = 1.25;
export const SUMMER_WORKER_SPEED = 1.15;
export const AUTUMN_BONUS_EVERY = 4;
export const WINTER_MACHINE_SPEED = 1.2;

/** Days since the farm was founded (day 1 starts in the morning, at DAY_START). */
const dayPos = (clock: number) => clock / DAY_LENGTH + DAY_START;

/** 0 spring … 3 winter. */
export const seasonIndex = (clock: number) => Math.floor(dayPos(clock) / DAYS_PER_SEASON) % SEASON_ORDER.length;
export const seasonOf = (clock: number): SeasonId => SEASON_ORDER[seasonIndex(clock)];
/** Seasons since the farm was founded (0 = the first spring). */
export const seasonSerial = (clock: number) => Math.floor(dayPos(clock) / DAYS_PER_SEASON);
/** Day within the season, 1 … DAYS_PER_SEASON. */
export const seasonDay = (clock: number) => (Math.floor(dayPos(clock)) % DAYS_PER_SEASON) + 1;
export const yearNumber = (clock: number) => Math.floor(dayPos(clock) / (DAYS_PER_SEASON * SEASON_ORDER.length)) + 1;

/** Seconds of play until the next season starts. */
export function seasonTimeLeft(clock: number) {
  const p = dayPos(clock) / DAYS_PER_SEASON;
  return (Math.floor(p) + 1 - p) * SEASON_LENGTH;
}

export const nextSeason = (s: SeasonId) => SEASON_ORDER[(SEASON_ORDER.indexOf(s) + 1) % SEASON_ORDER.length];

/** Visual change-over (in days) before and after the midnight a season changes. */
const BLEND_BEFORE = 0.1;
const BLEND_AFTER = 0.04;

/**
 * Visual season mix: season `a` turning into season `b` by `k` (0 … 1). The
 * world changes during the night of the change-over, so the player wakes up
 * to snow instead of watching it pop in.
 */
export function seasonBlend(clock: number): { a: SeasonId; b: SeasonId; k: number } {
  const p = dayPos(clock);
  const idx = Math.floor(p / DAYS_PER_SEASON);
  const into = p - idx * DAYS_PER_SEASON;
  const left = DAYS_PER_SEASON - into;
  const n = SEASON_ORDER.length;
  const at = (i: number) => SEASON_ORDER[((i % n) + n) % n];
  const span = BLEND_BEFORE + BLEND_AFTER;
  if (into < BLEND_AFTER && idx > 0) return { a: at(idx - 1), b: at(idx), k: smooth((into + BLEND_BEFORE) / span) };
  if (left < BLEND_BEFORE) return { a: at(idx), b: at(idx + 1), k: smooth((BLEND_BEFORE - left) / span) };
  return { a: at(idx), b: at(idx), k: 0 };
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Price multiplier for `item` in `season` (seasonal demand). */
export const seasonDemand = (season: SeasonId, item: ItemId) => (SEASONS[season].demand.includes(item) ? DEMAND_MULT : 1);

/** Growth speed multiplier of a crop in a season. */
export const seasonGrowth = (season: SeasonId, crop: CropDef) => (season === "spring" && crop.kind === "plant" ? SPRING_GROWTH : 1);

export const seasonWorkerSpeed = (season: SeasonId) => (season === "summer" ? SUMMER_WORKER_SPEED : 1);
export const seasonMachineSpeed = (season: SeasonId) => (season === "winter" ? WINTER_MACHINE_SPEED : 1);
