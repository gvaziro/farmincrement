/**
 * Combines keyboard and virtual-joystick input into game.input, and holds the
 * camera zoom requested by the mouse wheel / pinch.
 */
import type { Game } from "@/game/engine/Game";

export const input = {
  kb: { x: 0, z: 0 },
  stick: { x: 0, z: 0, active: false },
  /** 1 = base distance; wheel moves it within [0.65, 1.9]. */
  zoom: 1.15,
};

export function applyInput(game: Game) {
  if (input.stick.active) {
    game.input.x = input.stick.x;
    game.input.z = input.stick.z;
    return;
  }
  const { x, z } = input.kb;
  const len = Math.hypot(x, z) || 1;
  game.input.x = x / len;
  game.input.z = z / len;
}

export function addZoom(delta: number) {
  input.zoom = Math.min(1.9, Math.max(0.65, input.zoom * Math.exp(delta)));
}
