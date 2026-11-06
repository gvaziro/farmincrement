/** Money a world earns while nobody is looking at it. */
import { OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY } from "../data/balance";
import { HOLIDAY_EFFICIENCY_PER_LEVEL, HOLIDAY_HOURS_PER_LEVEL } from "../data/legacy";
import type { GameState } from "./types";

/** A shorter absence pays nothing. */
export const OFFLINE_MIN_SECONDS = 60;

/** Money earned while the tab was closed ("long holiday" raises the cap and the share). */
export function offlineEarnings(rate: number, seconds: number, holiday = 0) {
  const cap = OFFLINE_CAP_SECONDS + holiday * HOLIDAY_HOURS_PER_LEVEL * 3600;
  const s = Math.max(0, Math.min(seconds, cap));
  return { seconds: s, money: Math.floor(rate * s * (OFFLINE_EFFICIENCY + holiday * HOLIDAY_EFFICIENCY_PER_LEVEL)) };
}

/** What this world earned on its own; the city also got the farm's "копеечка". */
export const offlineFor = (st: GameState, seconds: number, holiday = 0) => offlineEarnings(st.autoIncome.rate + (st.city?.penny ?? 0), seconds, holiday);
