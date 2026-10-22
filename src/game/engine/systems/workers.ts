/**
 * Worker AI: tiny finite-state machines on top of A* paths.
 *   harvester: harvest → toTarget → drop → harvest …
 *   carrier:   toSource → collect → toTarget → drop → toSource …
 *   operator:  toSpot → operate (boosts the machine)
 */
import { pointInRect, type Rect } from "../../core/math";
import type { CropId } from "../../data/crops";
import { fieldById } from "../../data/layout";
import type { Game } from "../Game";
import type { Worker } from "../types";
import { machineAccepts } from "./interact";
import { harvestAround, isRipe } from "./harvest";
import { moveActor, updateLean } from "./movement";

const ARRIVE = 0.18;
const cropSets = new Map<string, ReadonlySet<CropId>>();

export function updateWorkers(game: Game, dt: number) {
  for (const w of game.state.workers) {
    w.spawnT += dt;
    w.fullT += dt;
    switch (w.def.job.kind) {
      case "harvester":
        harvester(game, w, dt);
        break;
      case "carrier":
        carrier(game, w, dt);
        break;
      case "operator":
        operator(game, w, dt);
        break;
    }
  }
}

// ── movement helpers ────────────────────────────────────────────────────
function setDestination(game: Game, w: Worker, x: number, z: number, keepBlocked = false) {
  const path = game.nav.findPath(w.x, w.z, x, z);
  w.path = path ?? [{ x, z }];
  w.pathIdx = 0;
  w.stuck = 0;
  if (!keepBlocked) w.repath = 0;
}

/** Follow the current path. Returns true once the last point is reached. */
function followPath(game: Game, w: Worker, dt: number): boolean {
  if (w.pathIdx >= w.path.length) {
    idle(game, w, dt);
    return true;
  }
  const target = w.path[w.pathIdx];
  const dx = target.x - w.x;
  const dz = target.z - w.z;
  const d = Math.hypot(dx, dz);
  if (d < ARRIVE) {
    w.pathIdx++;
    if (w.pathIdx >= w.path.length) {
      idle(game, w, dt);
      return true;
    }
    return false;
  }
  const sp = Math.min(w.speed, d / dt);
  const bx = w.x;
  const bz = w.z;
  moveActor(game, w, (dx / d) * sp, (dz / d) * sp, dt);
  // Re-plan when blocked (a building popped up on the path, etc.).
  if (Math.hypot(w.x - bx, w.z - bz) < w.speed * dt * 0.2) {
    w.stuck += dt;
    w.repath += dt;
    const last = w.path[w.path.length - 1];
    if (w.repath > 6) {
      // Last resort: never let a worker freeze for good — hop to the goal.
      w.x = last.x;
      w.z = last.z;
      w.pathIdx = w.path.length;
      w.repath = 0;
      return true;
    }
    if (w.stuck > 0.8) setDestination(game, w, last.x, last.z, true);
  } else {
    w.stuck = 0;
    w.repath = Math.max(0, w.repath - dt);
  }
  return false;
}

function idle(game: Game, w: Worker, dt: number) {
  moveActor(game, w, 0, 0, dt);
}

function goToRect(game: Game, w: Worker, r: Rect) {
  const x = r.x + Math.max(-r.hw + 0.3, Math.min(r.hw - 0.3, w.jitter.x));
  const z = r.z + Math.max(-r.hd + 0.3, Math.min(r.hd - 0.3, w.jitter.z));
  setDestination(game, w, x, z);
}

function faceTowards(w: Worker, x: number, z: number, dt: number) {
  const want = Math.atan2(x - w.x, z - w.z);
  let d = (want - w.facing) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  w.facing += d * Math.min(1, dt * 8);
}

function landedCount(w: Worker) {
  return w.stack.length - w.incoming;
}

// ── harvester ───────────────────────────────────────────────────────────
function harvester(game: Game, w: Worker, dt: number) {
  const job = w.def.job;
  if (job.kind !== "harvester") return;
  const machine = game.machine(job.target);
  if (!machine) return idle(game, w, dt);
  let crops = cropSets.get(w.id);
  if (!crops) {
    crops = new Set(job.fields.map((id) => fieldById(id).crop));
    cropSets.set(w.id, crops);
  }

  switch (w.phase) {
    case "spawn":
      if (w.spawnT > 0.6) w.phase = "harvest";
      updateLean(w, dt);
      return;

    case "harvest": {
      harvestAround(game, w, crops);
      if (w.stack.length >= w.capacity) return deliver(game, w, machine.inRect, `in:${machine.id}`);
      // Pick (or keep) a ripe plant to walk to.
      const t = w.harvestTarget;
      const field = t ? game.state.fields[t.field] : null;
      const plant = t && field ? field.plants[t.plant] : null;
      const ripe = !!plant && isRipe(field!.crop, plant);
      if (!ripe || !plant) {
        w.harvestTarget = nearestRipe(game, w, job.fields);
        if (!w.harvestTarget) {
          w.wait += dt;
          if (w.stack.length > 0 && w.wait > 1.2) return deliver(game, w, machine.inRect, `in:${machine.id}`);
          return idle(game, w, dt);
        }
        const np = game.state.fields[w.harvestTarget.field].plants[w.harvestTarget.plant];
        setDestination(game, w, np.sx, np.sz);
      } else if (w.pathIdx >= w.path.length) {
        setDestination(game, w, plant.sx, plant.sz);
      }
      w.wait = 0;
      followPath(game, w, dt);
      return;
    }

    case "toTarget":
      if (followPath(game, w, dt) || pointInRect(w.x, w.z, machine.inRect, -0.25)) {
        w.phase = "drop";
        w.wait = 0;
      }
      return;

    case "drop": {
      idle(game, w, dt);
      faceTowards(w, machine.def.x, machine.def.z, dt);
      if (w.stack.length === 0) return backToField(w);
      // Machine is full: top the stack up in the meantime instead of idling.
      const canDrop = w.stack.some((it) => machineAccepts(machine, it));
      if (!canDrop && landedCount(w) === w.stack.length && w.stack.length < w.capacity) {
        w.wait += dt;
        if (w.wait > 2.5) backToField(w);
      } else w.wait = 0;
      return;
    }
  }
}

function backToField(w: Worker) {
  w.phase = "harvest";
  w.targetZone = null;
  w.harvestTarget = null;
  w.wait = 0;
}

function deliver(game: Game, w: Worker, r: Rect, zone: string) {
  w.phase = "toTarget";
  w.targetZone = zone;
  w.harvestTarget = null;
  goToRect(game, w, r);
}

function nearestRipe(game: Game, w: Worker, fieldIds: readonly string[]) {
  let best: { field: number; plant: number } | null = null;
  let bestD = Infinity;
  const fields = game.state.fields;
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    if (!fieldIds.includes(f.id) || f.spawnT < 0.7) continue;
    for (let pi = 0; pi < f.plants.length; pi++) {
      const p = f.plants[pi];
      if (!isRipe(f.crop, p)) continue;
      // Prefer plants nobody else is heading to.
      let taken = false;
      for (const o of game.state.workers) {
        if (o !== w && o.harvestTarget && o.harvestTarget.field === fi && o.harvestTarget.plant === pi) {
          taken = true;
          break;
        }
      }
      const d = Math.hypot(p.sx - w.x, p.sz - w.z) + (taken ? 6 : 0);
      if (d < bestD) {
        bestD = d;
        best = { field: fi, plant: pi };
      }
    }
  }
  return best;
}

// ── carrier ─────────────────────────────────────────────────────────────
function carrier(game: Game, w: Worker, dt: number) {
  const job = w.def.job;
  if (job.kind !== "carrier") return;
  const source = game.machine(job.source);
  if (!source) return idle(game, w, dt);

  let targetRect: Rect | null = null;
  let targetZone = "";
  const tgt = job.target;
  if (tgt.kind === "machine") {
    const m = game.machine(tgt.id);
    if (m) {
      targetRect = m.inRect;
      targetZone = `in:${m.id}`;
    }
  } else {
    const z = game.interactById(tgt.kind === "market" ? "market" : "depot");
    if (z) {
      targetRect = z.rect;
      targetZone = z.id;
    }
  }
  if (!targetRect) return idle(game, w, dt);

  switch (w.phase) {
    case "spawn":
      updateLean(w, dt);
      if (w.spawnT > 0.6) {
        w.phase = "toSource";
        w.targetZone = `out:${source.id}`;
        goToRect(game, w, source.outRect);
      }
      return;

    case "toSource":
      if (followPath(game, w, dt) || pointInRect(w.x, w.z, source.outRect, -0.25)) {
        w.phase = "collect";
        w.wait = 0;
      }
      return;

    case "collect":
      idle(game, w, dt);
      faceTowards(w, source.def.x, source.def.z, dt);
      if (w.stack.length >= w.capacity) {
        w.wait += dt;
        if (w.wait > 0.25) goTarget(game, w, targetRect, targetZone);
      } else if (source.output - source.incomingOut <= 0) {
        w.wait += dt;
        // Leave with a partial load if the machine is slow.
        if (w.stack.length > 0 && w.wait > 2.0) goTarget(game, w, targetRect, targetZone);
      } else w.wait = 0;
      return;

    case "toTarget":
      if (followPath(game, w, dt) || pointInRect(w.x, w.z, targetRect, -0.25)) {
        w.phase = "drop";
        w.wait = 0;
      }
      return;

    case "drop": {
      idle(game, w, dt);
      if (tgt.kind === "machine") {
        const m = game.machine(tgt.id)!;
        faceTowards(w, m.def.x, m.def.z, dt);
      }
      if (w.stack.length === 0) {
        w.phase = "toSource";
        w.targetZone = `out:${source.id}`;
        goToRect(game, w, source.outRect);
      }
      return;
    }
  }
}

function goTarget(game: Game, w: Worker, r: Rect, zone: string) {
  w.phase = "toTarget";
  w.targetZone = zone;
  w.wait = 0;
  goToRect(game, w, r);
}

// ── operator ────────────────────────────────────────────────────────────
function operator(game: Game, w: Worker, dt: number) {
  const job = w.def.job;
  if (job.kind !== "operator") return;
  const m = game.machine(job.machine);
  if (!m) return idle(game, w, dt);
  const spotX = m.def.x + m.type.opSpot[0];
  const spotZ = m.def.z + m.type.opSpot[1];
  switch (w.phase) {
    case "spawn":
      updateLean(w, dt);
      if (w.spawnT > 0.6) {
        w.phase = "toSpot";
        setDestination(game, w, spotX, spotZ);
      }
      return;
    case "toSpot":
      if (followPath(game, w, dt) || Math.hypot(w.x - spotX, w.z - spotZ) < 0.3) w.phase = "operate";
      return;
    case "operate":
      idle(game, w, dt);
      faceTowards(w, m.def.x, m.def.z, dt);
      m.operator = true;
      return;
  }
}
