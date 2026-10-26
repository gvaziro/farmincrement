/**
 * Weather: one event per day at most — a shower, a morning fog or a
 * snowfall — picked from the day number, so it is the same after a reload
 * and needs no saving. Chances depend on the season. Like the night and the
 * seasons, weather only ever helps: plants grow faster in the rain.
 */
import { mulberry32 } from "../core/math";
import type { CropDef } from "../data/crops";
import { DAY_LENGTH, dayNumber, timeOfDay } from "./daycycle";
import { DAYS_PER_SEASON, SEASON_ORDER, type SeasonId } from "./seasons";

export type WeatherKind = "clear" | "rain" | "fog" | "snow";

export interface WeatherDay {
  kind: WeatherKind;
  /** Start and end as a time of day (0 … 1); weather never crosses midnight. */
  start: number;
  end: number;
}

export const WEATHER_NAMES: Record<WeatherKind, { name: string; icon: string }> = {
  clear: { name: "Ясно", icon: "☀️" },
  rain: { name: "Дождь", icon: "🌧️" },
  fog: { name: "Туман", icon: "🌫️" },
  snow: { name: "Снегопад", icon: "🌨️" },
};

/** Chance of each kind of weather on a day of the season (the rest is clear). */
export const WEATHER_CHANCES: Record<SeasonId, readonly [WeatherKind, number][]> = {
  spring: [["rain", 0.35], ["fog", 0.12]],
  summer: [["rain", 0.25]],
  autumn: [["rain", 0.35], ["fog", 0.25]],
  winter: [["snow", 0.45], ["fog", 0.12]],
};

/** Plants and trees grow this much faster in the rain. */
export const RAIN_GROWTH = 1.5;
/** Fade in/out of a weather event, as a share of the day. */
const RAMP = 0.02;
/** How long a rainbow lingers after a spring or summer shower. */
export const RAINBOW_TIME = 0.06;

const CLEAR: WeatherDay = { kind: "clear", start: 0, end: 0 };

/** Season of day N (1-based). */
export const seasonOfDay = (day: number): SeasonId => SEASON_ORDER[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASON_ORDER.length];

/** The weather of day N (1-based). The very first day is always sunny. */
export function weatherOfDay(day: number, frozen?: SeasonId): WeatherDay {
  if (day <= 1) return CLEAR;
  const rnd = mulberry32(day * 7919 + 17);
  const roll = rnd();
  let acc = 0;
  let kind: WeatherKind = "clear";
  for (const [k, p] of WEATHER_CHANCES[frozen ?? seasonOfDay(day)]) {
    acc += p;
    if (roll < acc) {
      kind = k;
      break;
    }
  }
  if (kind === "clear") return CLEAR;
  if (kind === "fog") {
    // Morning fog that burns off.
    const start = 0.07 + rnd() * 0.04;
    return { kind, start, end: start + 0.12 + rnd() * 0.08 };
  }
  // Showers end in daylight, so a rainbow still has sun to shine in.
  const start = kind === "snow" ? 0.15 + rnd() * 0.4 : 0.2 + rnd() * 0.35;
  const len = kind === "snow" ? 0.15 + rnd() * 0.12 : 0.1 + rnd() * 0.1;
  return { kind, start, end: start + len };
}

/** Weather right now: its kind and intensity (0 … 1, ramps in and out). */
export function weatherAt(clock: number, frozen?: SeasonId): { kind: WeatherKind; k: number } {
  const w = weatherOfDay(dayNumber(clock), frozen);
  const t = timeOfDay(clock);
  if (w.kind === "clear" || t <= w.start || t >= w.end) return { kind: "clear", k: 0 };
  return { kind: w.kind, k: Math.min(1, (t - w.start) / RAMP, (w.end - t) / RAMP) };
}

/** A rainbow after a spring or summer shower: 0 … 1. */
export function rainbowAt(clock: number, frozen?: SeasonId): number {
  const day = dayNumber(clock);
  const w = weatherOfDay(day, frozen);
  if (w.kind !== "rain") return 0;
  const s = frozen ?? seasonOfDay(day);
  if (s !== "spring" && s !== "summer") return 0;
  const t = timeOfDay(clock);
  if (t < w.end - RAMP || t > w.end + RAINBOW_TIME) return 0;
  const k = Math.min((t - (w.end - RAMP)) / RAMP, (w.end + RAINBOW_TIME - t) / (RAINBOW_TIME * 0.4));
  return Math.max(0, Math.min(1, k));
}

/** Weather that counts for gameplay: once it is properly under way. */
export function currentWeather(clock: number, frozen?: SeasonId): WeatherKind {
  const w = weatherAt(clock, frozen);
  return w.k > 0.3 ? w.kind : "clear";
}

/** Growth multiplier the weather gives a crop (fish do not care about rain). */
export const weatherGrowth = (raining: boolean, crop: CropDef) => (raining && crop.kind !== "water" ? RAIN_GROWTH : 1);

/** Seconds of play until the weather of the current day starts (or null). */
export function weatherStartsIn(clock: number, frozen?: SeasonId): number | null {
  const w = weatherOfDay(dayNumber(clock), frozen);
  const t = timeOfDay(clock);
  if (w.kind === "clear" || t >= w.start) return null;
  return (w.start - t) * DAY_LENGTH;
}
