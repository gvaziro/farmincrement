import { useEffect } from "react";
import type { Game } from "@/game/engine/Game";
import { updateSettings, useUI } from "@/runtime/store";
import { toggleFullscreen } from "./fullscreen";
import { addZoom, applyInput, input } from "./input";
import { NEWS_VERSION } from "./news";

const UP = new Set(["KeyW", "ArrowUp"]);
const DOWN = new Set(["KeyS", "ArrowDown"]);
const LEFT = new Set(["KeyA", "ArrowLeft"]);
const RIGHT = new Set(["KeyD", "ArrowRight"]);

/** Esc: close whatever window is open (the farmhouse panel, settings, notices). */
function closeWindows() {
  const ui = useUI.getState();
  if (ui.tabBlocked) return;
  if (ui.news) updateSettings({ seenNews: NEWS_VERSION });
  useUI.setState({ panel: null, settingsOpen: false, offline: null, news: false });
}

export function useKeyboard(game: Game) {
  useEffect(() => {
    const held = new Set<string>();
    const recompute = () => {
      let x = 0;
      let z = 0;
      for (const k of held) {
        if (UP.has(k)) z -= 1;
        if (DOWN.has(k)) z += 1;
        if (LEFT.has(k)) x -= 1;
        if (RIGHT.has(k)) x += 1;
      }
      input.kb.x = Math.sign(x);
      input.kb.z = Math.sign(z);
      applyInput(game);
    };
    const down = (e: KeyboardEvent) => {
      // Typing a save code must not walk the farmer around.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (UP.has(e.code) || DOWN.has(e.code) || LEFT.has(e.code) || RIGHT.has(e.code)) {
        held.add(e.code);
        recompute();
        e.preventDefault();
      } else if (e.code === "Equal" || e.code === "NumpadAdd") addZoom(-0.12);
      else if (e.code === "Minus" || e.code === "NumpadSubtract") addZoom(0.12);
      else if (e.code === "Escape") closeWindows();
      else if (e.code === "KeyM" && !e.repeat) {
        // Mute everything, or bring everything back.
        const s = useUI.getState().settings;
        const on = !(s.sound || s.music);
        updateSettings({ sound: on, music: on });
      } else if (e.code === "KeyF" && !e.repeat) toggleFullscreen();
      else if (e.code === "Space") {
        // The foreman's whistle — unless a button has the focus (Space presses it)
        // or a window is open (the whistle button is hidden then).
        const ui = useUI.getState();
        if (t?.tagName === "BUTTON" || ui.panel || ui.settingsOpen || ui.news || ui.offline || ui.tabBlocked) return;
        e.preventDefault();
        if (!e.repeat) game.whistle();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) recompute();
    };
    const blur = () => {
      held.clear();
      recompute();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [game]);
}
