"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { InstancedMesh, MeshLambertMaterial, Object3D } from "three";
import { easeOutBack } from "@/game/core/math";
import { ITEM_IDS, ITEMS, type ItemId } from "@/game/data/items";
import { STACK_BASE_Y, inputSlot, layoutStack, outputSlot } from "@/game/engine/anchors";
import { truckSlot } from "@/game/engine/systems/depot";
import { DEPOT_VISIBLE, depotSlot } from "@/game/engine/systems/interact";
import type { Actor, FlightItem, Worker } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { itemGeometry } from "./models/itemModels";

const vmat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const KINDS: FlightItem[] = [...ITEM_IDS, "coin"];
const CAP = 1400;
const dummy = new Object3D();
const buf = new Float32Array(3 * 200);

/** Vertical bob shared with the character animation so stacks ride along. */
export function actorBob(a: Actor, t: number) {
  const moving = a.moving && Math.hypot(a.vx, a.vz) > 0.3;
  return moving ? Math.abs(Math.sin(a.walk * 2.2)) * 0.07 : Math.sin(t * 2.4) * 0.012;
}

const jitter = (i: number) => (((i * 2654435761) >>> 0) / 4294967296 - 0.5) * 0.35;

export function Items({ runtime }: { runtime: Runtime }) {
  const refs = useRef<Partial<Record<FlightItem, InstancedMesh>>>({});
  const counts = useMemo(() => new Map<FlightItem, number>(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = runtime.game;
    const st = g.state;
    for (const k of KINDS) counts.set(k, 0);

    const put = (item: FlightItem, x: number, y: number, z: number, yaw: number, rx = 0, rz = 0, s = 1) => {
      const m = refs.current[item];
      if (!m) return;
      const n = counts.get(item)!;
      if (n >= CAP) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, yaw, rz);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      counts.set(item, n + 1);
    };

    // Carried stacks.
    const drawStack = (a: Actor, scale: number) => {
      const visible = Math.min(a.stack.length - a.incoming, 200);
      if (visible <= 0) return;
      layoutStack(a.stack, a.capacity, buf, visible);
      const c = Math.cos(a.facing);
      const s = Math.sin(a.facing);
      const bob = actorBob(a, t);
      const lean = a.lean;
      for (let i = 0; i < visible; i++) {
        const lx0 = buf[i * 3];
        const ly = buf[i * 3 + 1];
        const lz0 = buf[i * 3 + 2];
        const h = Math.max(0, ly - STACK_BASE_Y);
        const bend = Math.pow(h, 1.35);
        const lx = lx0 + lean.x * bend;
        const lz = lz0 + lean.z * bend;
        const wx = a.x + (lx * c + lz * s) * scale;
        const wz = a.z + (-lx * s + lz * c) * scale;
        put(a.stack[i], wx, (ly + bob) * scale, wz, a.facing + jitter(i), lean.z * h * 0.25, -lean.x * h * 0.25, scale);
      }
    };
    drawStack(st.player, 1);
    for (const w of st.workers) {
      const sc = (w as Worker).spawnT < 0.6 ? Math.max(0.01, easeOutBack(w.spawnT / 0.6)) : 1;
      drawStack(w, sc);
    }

    // Machine pallets.
    for (const m of st.machines) {
      if (m.spawnT < 0.5) continue;
      for (const inp of m.type.inputs) {
        const n = Math.max(0, (m.inputs[inp.item] ?? 0) - (m.incomingIn[inp.item] ?? 0));
        for (let i = 0; i < n; i++) {
          const p = inputSlot(m, inp.item, i);
          put(inp.item, p.x, p.y, p.z, jitter(i) * 0.6);
        }
      }
      const item = m.type.output.item;
      const n = Math.max(0, m.output - m.incomingOut);
      for (let i = 0; i < n; i++) {
        const p = outputSlot(m, i);
        put(item, p.x, p.y, p.z, jitter(i + 7) * 0.6);
      }
    }

    // Depot storage and trucks.
    const d = st.depot;
    if (d) {
      const n = Math.min(d.storage.length - d.incoming, DEPOT_VISIBLE);
      for (let i = 0; i < n; i++) {
        const p = depotSlot(i);
        put(d.storage[i], p.x, p.y, p.z, jitter(i) * 0.5);
      }
      for (const tr of d.trucks) {
        if (tr.phase === "away") continue;
        const c = tr.cargo.length - tr.incoming;
        for (let i = 0; i < c; i++) {
          const p = truckSlot(tr, i);
          put(tr.cargo[i], p.x, p.y, p.z, Math.PI / 2 + jitter(i) * 0.4);
        }
      }
    }

    // Items in flight: straight in x/z, parabola in y.
    for (const f of st.flights) {
      const to = g.anchorPos(f.to);
      const u = f.t;
      const x = f.fx + (to.x - f.fx) * u;
      const z = f.fz + (to.z - f.fz) * u;
      const y = f.fy + (to.y - f.fy) * u + f.arc * 4 * u * (1 - u);
      const s = u < 0.2 ? 0.75 + 1.25 * u : 1;
      if (f.item === "coin") put("coin", x, y + 0.15, z, f.spin * u * 3, 0, 0, s);
      else put(f.item, x, y, z, f.spin * u, f.spin * u * 0.5, 0, s);
    }

    for (const k of KINDS) {
      const m = refs.current[k];
      if (!m) continue;
      m.count = counts.get(k)!;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {KINDS.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            if (m) refs.current[k] = m;
          }}
          args={[itemGeometry(k), vmat, CAP]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

export const itemHeight = (id: ItemId) => ITEMS[id].height;
