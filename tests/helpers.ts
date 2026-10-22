import { Game } from "@/game/engine/Game";

export const DT = 1 / 30;

/** Advance the simulation by `seconds` in fixed steps. */
export function run(game: Game, seconds: number) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) game.tick(DT);
}

/** Steer the player to (x,z) using the joystick input. Returns true on arrival. */
export function walkTo(game: Game, x: number, z: number, timeout = 30, radius = 0.25) {
  const p = game.state.player;
  for (let t = 0; t < timeout; t += DT) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < radius) {
      game.input.x = 0;
      game.input.z = 0;
      return true;
    }
    // Follow a nav path so tests don't get stuck on buildings.
    const path = game.nav.findPath(p.x, p.z, x, z);
    const next = path?.[0] ?? { x, z };
    const nx = next.x - p.x;
    const nz = next.z - p.z;
    const nd = Math.hypot(nx, nz) || 1;
    const slow = Math.min(1, d / 0.6);
    game.input.x = (nx / nd) * slow;
    game.input.z = (nz / nd) * slow;
    game.tick(DT);
  }
  game.input.x = 0;
  game.input.z = 0;
  return false;
}

/** Stand still for `seconds`. */
export function wait(game: Game, seconds: number) {
  game.input.x = 0;
  game.input.z = 0;
  run(game, seconds);
}
