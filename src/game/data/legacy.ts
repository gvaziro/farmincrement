/**
 * The legacy shop: family upgrades bought with stars. Stars are earned by
 * handing the farm over to the next generation (after the Golden Statue) and
 * are spent here — each generation then plays a bit faster than the last.
 */
import { formatMoney } from "../core/format";

export const PERK_IDS = ["fame", "treasury", "hands", "crew", "soil", "workshop", "lands", "holiday", "fair", "golden", "voice", "ancestors"] as const;
export type PerkId = (typeof PERK_IDS)[number];

export interface PerkDef {
  id: PerkId;
  name: string;
  icon: string;
  max: number;
  /** Star price of level `n` (1-based). */
  cost: (n: number) => number;
  /** What `level` levels give, for the shop card. */
  effect: (level: number) => string;
  /** Only takes effect when a new generation starts. */
  nextGeneration?: boolean;
}

/** n-th price of a geometric series, rounded. */
const series = (base: number, growth: number) => (n: number) => Math.round(base * Math.pow(growth, n - 1));

export const FAME_PER_LEVEL = 0.15;
export const SOIL_PER_LEVEL = 0.1;
export const WORKSHOP_PER_LEVEL = 0.1;
export const FAIR_PER_LEVEL = 0.25;
export const HOLIDAY_HOURS_PER_LEVEL = 2;
export const HOLIDAY_EFFICIENCY_PER_LEVEL = 0.05;
/** "Золотые руки": golden plants come this much more often per level. */
export const GOLDEN_PER_LEVEL = 0.2;
/** "Зычный голос": the whistle sounds longer and rests less, per level (seconds). */
export const VOICE_TIME_PER_LEVEL = 6;
export const VOICE_REST_PER_LEVEL = 15;
/** Money a new generation starts with, by "family treasury" level. */
export const TREASURY_MONEY = [0, 1_000, 10_000, 100_000, 1_000_000] as const;
/** Plots a new generation already owns, by "family lands" level (in order). */
export const LANDS_ORDER = ["coop", "pasture", "depot"] as const;

export const PERKS: Record<PerkId, PerkDef> = {
  fame: {
    id: "fame",
    name: "Добрая слава",
    icon: "📣",
    max: 10,
    cost: series(2, 1.5),
    effect: (l) => `+${Math.round(l * FAME_PER_LEVEL * 100)}% к ценам продажи`,
  },
  treasury: {
    id: "treasury",
    name: "Семейная казна",
    icon: "💰",
    max: TREASURY_MONEY.length - 1,
    cost: (n) => [1, 3, 8, 20][n - 1],
    effect: (l) => `стартовый капитал $${formatMoney(TREASURY_MONEY[l])}`,
    nextGeneration: true,
  },
  hands: {
    id: "hands",
    name: "Крепкие руки",
    icon: "💪",
    max: 5,
    cost: series(2, 1.7),
    effect: (l) => `фермер начинает с вместимостью и скоростью +${l} ур.`,
    nextGeneration: true,
  },
  crew: {
    id: "crew",
    name: "Верная бригада",
    icon: "👷",
    max: 5,
    cost: series(2, 1.7),
    effect: (l) => `работники начинают со скоростью и вместимостью +${l} ур.`,
    nextGeneration: true,
  },
  soil: {
    id: "soil",
    name: "Плодородная земля",
    icon: "🌱",
    max: 5,
    cost: series(3, 1.7),
    effect: (l) => `посадки и сады растут на ${Math.round(l * SOIL_PER_LEVEL * 100)}% быстрее`,
  },
  workshop: {
    id: "workshop",
    name: "Отцовские станки",
    icon: "⚙️",
    max: 5,
    cost: series(3, 1.7),
    effect: (l) => `улучшения машин дешевле на ${Math.round(l * WORKSHOP_PER_LEVEL * 100)}%`,
  },
  lands: {
    id: "lands",
    name: "Родовые земли",
    icon: "🗺️",
    max: LANDS_ORDER.length,
    cost: (n) => [3, 8, 20][n - 1],
    effect: (l) => ["", "Курятник уже твой", "Курятник и Пастбище уже твои", "Курятник, Пастбище и Склад уже твои"][l],
    nextGeneration: true,
  },
  holiday: {
    id: "holiday",
    name: "Долгий отпуск",
    icon: "🏖️",
    max: 4,
    cost: series(2, 2),
    effect: (l) =>
      `офлайн-доход до ${2 + l * HOLIDAY_HOURS_PER_LEVEL} ч, ${Math.round((0.6 + l * HOLIDAY_EFFICIENCY_PER_LEVEL) * 100)}% от обычного`,
  },
  fair: {
    id: "fair",
    name: "Ярмарочная хватка",
    icon: "🎪",
    max: 4,
    cost: series(2, 2),
    effect: (l) => `награды за заказы и ярмарки +${Math.round(l * FAIR_PER_LEVEL * 100)}%`,
  },
  golden: {
    id: "golden",
    name: "Золотые руки",
    icon: "✨",
    max: 5,
    cost: series(4, 1.8),
    effect: (l) => `золотые растения появляются на ${Math.round(l * GOLDEN_PER_LEVEL * 100)}% чаще`,
  },
  voice: {
    id: "voice",
    name: "Зычный голос",
    icon: "📯",
    max: 5,
    cost: series(3, 1.8),
    effect: (l) => `свисток звучит +${l * VOICE_TIME_PER_LEVEL} с, отдыхает −${l * VOICE_REST_PER_LEVEL} с`,
  },
  ancestors: {
    id: "ancestors",
    name: "Опыт предков",
    icon: "🏭",
    max: 2,
    cost: (n) => [12, 30][n - 1],
    effect: (l) => `новые машины строятся сразу с ${l + 1}-м уровнем`,
  },
};

export const isPerkId = (v: unknown): v is PerkId => typeof v === "string" && (PERK_IDS as readonly string[]).includes(v);
