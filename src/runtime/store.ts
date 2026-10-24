import { create } from "zustand";
import type { HatId } from "@/game/data/hats";
import type { ItemId } from "@/game/data/items";
import type { SeasonId } from "@/game/engine/seasons";
import type { WeatherKind } from "@/game/engine/weather";

export type Quality = "high" | "medium" | "low";

export interface Settings {
  sound: boolean;
  music: boolean;
  /** 0 … 1 */
  soundVolume: number;
  musicVolume: number;
  vibration: boolean;
  /** Camera shake on purchases (some players get queasy). */
  shake: boolean;
  /** Last "what's new" the player has seen. */
  seenNews: number;
  quality: Quality;
  /** Visual day/night cycle (the in-game clock keeps running either way). */
  dayNight: boolean;
  /** Visual seasons and weather (the calendar and its perks run either way). */
  seasons: boolean;
}

export interface Toast {
  id: number;
  text: string;
  icon: string;
}

export interface GoalInfo {
  label: string;
  icon: string;
  cost: number;
}

/** Little events for the HUD, in whole seconds. */
export interface SurpriseUI {
  /** Gold rush seconds left. */
  rush: number;
  /** Whistle: seconds it still sounds, seconds until it can be blown again. */
  whistle: number;
  whistleCd: number;
  /** Anybody to whistle at (the button shows from the first hire). */
  workers: boolean;
}

export interface UIState {
  ready: boolean;
  money: number;
  stars: number;
  hint: { icon: string; text: string; item?: ItemId } | null;
  goal: GoalInfo | null;
  panel: "farmhouse" | null;
  toasts: Toast[];
  offline: { money: number; seconds: number } | null;
  settingsOpen: boolean;
  settings: Settings;
  statue: boolean;
  /** In-game clock for the HUD. */
  clock: { day: number; phase: "dawn" | "day" | "sunset" | "night"; season: SeasonId; weather: WeatherKind; rainbow: boolean };
  /** Player stack fill: [carried, capacity]. */
  carry: [number, number];
  /** The farmer's hat. */
  hat: HatId;
  /** Generations that farmed here before the current one (0 = the founders). */
  generation: number;
  /** Another tab owns the farm: "other" — at start, "taken" — it took over later. */
  tabBlocked: "other" | "taken" | null;
  /** Show the "what's new" window. */
  news: boolean;
  /** Number of unlocked achievements. */
  trophies: number;
  /** Finds in the album. */
  album: number;
  surprise: SurpriseUI;
  /** Bumped on every UI sync so panels can re-read engine data. */
  tick: number;
  /** Mirrors game.state.structure — 3D components re-render on it. */
  structure: number;
}

const SETTINGS_KEY = "tiny-farm-empire/settings";

function loadSettings(): Settings {
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const fallback: Settings = {
    sound: true,
    music: true,
    soundVolume: 1,
    musicVolume: 1,
    vibration: true,
    shake: true,
    seenNews: 0,
    quality: coarse ? "medium" : "high",
    dayNight: true,
    seasons: true,
  };
  const unit = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    if (!raw) return fallback;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: s.sound ?? fallback.sound,
      music: s.music ?? fallback.music,
      soundVolume: unit(s.soundVolume, fallback.soundVolume),
      musicVolume: unit(s.musicVolume, fallback.musicVolume),
      vibration: s.vibration ?? fallback.vibration,
      shake: s.shake ?? fallback.shake,
      seenNews: typeof s.seenNews === "number" ? s.seenNews : fallback.seenNews,
      quality: s.quality === "high" || s.quality === "medium" || s.quality === "low" ? s.quality : fallback.quality,
      dayNight: s.dayNight ?? fallback.dayNight,
      seasons: s.seasons ?? fallback.seasons,
    };
  } catch {
    return fallback;
  }
}

export const useUI = create<UIState>(() => ({
  ready: false,
  money: 0,
  stars: 0,
  hint: null,
  goal: null,
  panel: null,
  toasts: [],
  offline: null,
  settingsOpen: false,
  settings: loadSettings(),
  statue: false,
  carry: [0, 10],
  hat: "straw",
  generation: 0,
  trophies: 0,
  album: 0,
  surprise: { rush: 0, whistle: 0, whistleCd: 0, workers: false },
  tabBlocked: null,
  news: false,
  clock: { day: 1, phase: "day", season: "spring", weather: "clear", rainbow: false },
  tick: 0,
  structure: 0,
}));

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...useUI.getState().settings, ...patch };
  useUI.setState({ settings });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings stay in memory */
  }
}

let toastId = 0;
const TOAST_TIME = 3200;
const MAX_TOASTS = 3;
/** Toasts waiting for a free slot — a burst (new season + achievement) must not hide any. */
const queue: Toast[] = [];

function showToast(t: Toast) {
  useUI.setState((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => {
    useUI.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
    const next = queue.shift();
    if (next) showToast(next);
  }, TOAST_TIME);
}

export function pushToast(text: string, icon: string) {
  const t = { id: ++toastId, text, icon };
  if (useUI.getState().toasts.length < MAX_TOASTS) showToast(t);
  else {
    queue.push(t);
    // Old news is not worth waiting for: keep the backlog short.
    if (queue.length > 6) queue.shift();
  }
}
