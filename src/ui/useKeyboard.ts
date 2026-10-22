import { useEffect } from "react";
import type { Game } from "@/game/engine/Game";
import { addZoom, applyInput, input } from "./input";

const UP = new Set(["KeyW", "ArrowUp"]);
const DOWN = new Set(["KeyS", "ArrowDown"]);
const LEFT = new Set(["KeyA", "ArrowLeft"]);
const RIGHT = new Set(["KeyD", "ArrowRight"]);

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
      if (e.target instanceof HTMLInputElement) return;
      if (UP.has(e.code) || DOWN.has(e.code) || LEFT.has(e.code) || RIGHT.has(e.code)) {
        held.add(e.code);
        recompute();
        e.preventDefault();
      } else if (e.code === "Equal" || e.code === "NumpadAdd") addZoom(-0.12);
      else if (e.code === "Minus" || e.code === "NumpadSubtract") addZoom(0.12);
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
