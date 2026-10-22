import { dampAngle, dampFactor } from "../../core/math";
import type { Game } from "../Game";
import type { Actor } from "../types";
import { isLand } from "../world";

export const ACTOR_RADIUS = 0.35;

/**
 * Moves an actor towards a desired velocity, resolving collisions against
 * building footprints (circle vs AABB push-out) and locked land (axis slide).
 */
export function moveActor(game: Game, a: Actor, wantVx: number, wantVz: number, dt: number) {
  const st = game.state;
  const k = dampFactor(16, dt);
  a.vx += (wantVx - a.vx) * k;
  a.vz += (wantVz - a.vz) * k;

  let nx = a.x + a.vx * dt;
  let nz = a.z + a.vz * dt;

  for (const o of st.obstacles) {
    const ox = o.hw + ACTOR_RADIUS;
    const oz = o.hd + ACTOR_RADIUS;
    const dx = nx - o.x;
    const dz = nz - o.z;
    if (Math.abs(dx) < ox && Math.abs(dz) < oz) {
      const px = ox - Math.abs(dx);
      const pz = oz - Math.abs(dz);
      if (px < pz) nx = o.x + (dx < 0 ? -ox : ox);
      else nz = o.z + (dz < 0 ? -oz : oz);
    }
  }

  if (!isLand(st, nx, nz, ACTOR_RADIUS)) {
    if (isLand(st, nx, a.z, ACTOR_RADIUS)) nz = a.z;
    else if (isLand(st, a.x, nz, ACTOR_RADIUS)) nx = a.x;
    else {
      nx = a.x;
      nz = a.z;
    }
  }

  const moved = Math.hypot(nx - a.x, nz - a.z);
  a.x = nx;
  a.z = nz;
  const wantSpeed = Math.hypot(wantVx, wantVz);
  a.moving = wantSpeed > 0.2 && moved > 0.0005;
  a.walk += moved * 2.3;
  if (wantSpeed > 0.2) a.facing = dampAngle(a.facing, Math.atan2(wantVx, wantVz), 14, dt);
  updateLean(a, dt);
}

/** Spring that makes the carried tower sway against movement. */
export function updateLean(a: Actor, dt: number) {
  const c = Math.cos(a.facing);
  const s = Math.sin(a.facing);
  const fwd = a.vx * s + a.vz * c;
  const side = a.vx * c - a.vz * s;
  const tx = -side * 0.04;
  const tz = -fwd * 0.035;
  const L = a.lean;
  const stiffness = 70;
  const damping = 6;
  const steps = Math.max(1, Math.ceil(dt / 0.016));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    L.vx += ((tx - L.x) * stiffness - L.vx * damping) * h;
    L.vz += ((tz - L.z) * stiffness - L.vz * damping) * h;
    L.x += L.vx * h;
    L.z += L.vz * h;
  }
}
