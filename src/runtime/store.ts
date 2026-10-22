import { create } from "zustand";
import type { ItemId } from "@/game/data/items";

export type Quality = "high" | "medium" | "low";

export interface Settings {
  sound: boolean;
  music: boolean;
  quality: Quality;
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
  /** Player stack fill: [carried, capacity]. */
  carry: [number, number];
  /** Bumped on every UI sync so panels can re-read engine data. */
  tick: number;
  /** Mirrors game.state.structure — 3D components re-render on it. */
  structure: number;
}

const SETTINGS_KEY = "tiny-farm-empire/settings";

function loadSettings(): Settings {
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const fallback: Settings = { sound: true, music: true, quality: coarse ? "medium" : "high" };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    if (!raw) return fallback;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: s.sound ?? fallback.sound,
      music: s.music ?? fallback.music,
      quality: s.quality === "high" || s.quality === "medium" || s.quality === "low" ? s.quality : fallback.quality,
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
export function pushToast(text: string, icon: string) {
  const id = ++toastId;
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, icon }] }));
  setTimeout(() => useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
}
