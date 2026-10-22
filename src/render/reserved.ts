/** Areas used by gameplay — decoration must stay out of them. */
import { rect, type Rect } from "@/game/core/math";
import { CROPS } from "@/game/data/crops";
import { DEPOT, FARMHOUSE, FIELDS, MACHINES, MARKET, PADS, PLAYER_SPAWN, POND, STATUE, TRASH } from "@/game/data/layout";
import { MACHINE_TYPES } from "@/game/data/machines";

let cache: Rect[] | null = null;

export function reservedRects(): Rect[] {
  if (cache) return cache;
  const r: Rect[] = [];
  for (const f of FIELDS) {
    const s = CROPS[f.crop].spacing;
    r.push(rect(f.x, f.z, f.cols * s + 1.4, f.rows * s + 1.4));
  }
  for (const m of MACHINES) {
    const t = MACHINE_TYPES[m.type];
    const xs = [-t.size[0] / 2, t.size[0] / 2, t.inZone[0] - t.inZone[2] / 2, t.outZone[0] + t.outZone[2] / 2, t.upPad[0] + 1, t.opSpot[0] - 1];
    const zs = [-t.size[1] / 2 - 0.5, t.inZone[1] + t.inZone[3] / 2 + 0.6, t.upPad[1] + 1];
    const minX = Math.min(...xs) - 0.6;
    const maxX = Math.max(...xs) + 0.6;
    const minZ = Math.min(...zs) - 0.6;
    const maxZ = Math.max(...zs) + 0.4;
    r.push(rect(m.x + (minX + maxX) / 2, m.z + (minZ + maxZ) / 2, maxX - minX, maxZ - minZ));
  }
  for (const p of PADS) r.push(rect(p.x, p.z, p.size + 1.2, p.size + 1.2));
  r.push(rect(MARKET.x, MARKET.z + 1, MARKET.w + 2.5, MARKET.d + 5));
  r.push(rect(FARMHOUSE.x, FARMHOUSE.z + 0.8, FARMHOUSE.w + 2, FARMHOUSE.d + 3.5));
  r.push(rect(DEPOT.x, DEPOT.z + 1.5, DEPOT.w + 2, DEPOT.d + 5));
  r.push(rect((DEPOT.x + 40) / 2, DEPOT.roadZ, 40 - DEPOT.x + 8, 4));
  r.push(rect(STATUE.x, STATUE.z, STATUE.w + 2, STATUE.d + 2));
  r.push(rect(TRASH.x, TRASH.z - 0.5, TRASH.w + 1.2, TRASH.d + 2));
  r.push(rect(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 2, 2));
  // Pond, its shore and the fishing walkway.
  const w = POND.water;
  r.push(rect((w.x0 + w.x1) / 2 + 0.6, (w.z0 + w.z1) / 2, w.x1 - w.x0 + 3.4, w.z1 - w.z0 + 2));
  cache = r;
  return r;
}

export function isReserved(x: number, z: number, pad = 0) {
  for (const r of reservedRects()) {
    if (Math.abs(x - r.x) < r.hw + pad && Math.abs(z - r.z) < r.hd + pad) return true;
  }
  return false;
}
