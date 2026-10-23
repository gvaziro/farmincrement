/**
 * Day/night cycle. One in-game day lasts DAY_LENGTH seconds of play.
 * Time of day `t` runs 0..1: 0 = deep night (just before dawn),
 * ~0.16–0.62 = full day, ~0.79 = sunset, ~0.88–1 = night.
 */

export const DAY_LENGTH = 600;
/** A new game starts in the morning. */
export const DAY_START = 0.14;

export type DayPhase = "dawn" | "day" | "sunset" | "night";

/** Time of day in [0, 1) for a monotonic clock in seconds. */
export const timeOfDay = (clock: number) => {
  const t = clock / DAY_LENGTH + DAY_START;
  return t - Math.floor(t);
};

/** Day counter shown to the player: day 1 starts with the first morning. */
export const dayNumber = (clock: number) => Math.floor(clock / DAY_LENGTH + DAY_START) + 1;

const smooth = (e0: number, e1: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

/** 0 = broad daylight, 1 = full night. Smooth through dusk and dawn. */
export function nightFactor(t: number) {
  if (t >= 0.78) return smooth(0.78, 0.88, t);
  if (t <= 0.09) return 1 - smooth(0.01, 0.09, t);
  return 0;
}

export function dayPhase(t: number): DayPhase {
  if (t < 0.1) return nightFactor(t) > 0.5 ? "night" : "dawn";
  if (t < 0.7) return "day";
  if (t < 0.83) return "sunset";
  return nightFactor(t) > 0.5 ? "night" : "sunset";
}

export const isNight = (clock: number) => nightFactor(timeOfDay(clock)) > 0.5;

/** Fish bite this many times faster at night. */
export const NIGHT_FISHING_BOOST = 2;
