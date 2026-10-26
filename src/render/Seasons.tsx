"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CircleGeometry, Color, DoubleSide, MeshLambertMaterial, Object3D, type Group, type InstancedMesh } from "three";
import { mulberry32 } from "@/game/core/math";
import { frozenSeason } from "@/game/engine/challenges";
import { seasonBlend, type SeasonId } from "@/game/engine/seasons";
import type { Runtime } from "@/runtime/runtime";
import { useUI, type Quality } from "@/runtime/store";
import { seasonUniforms, seasonVisual } from "./seasonLook";

/** Turns the calendar into the seasonal look: shader uniforms + weights. */
export function SeasonController({ runtime }: { runtime: Runtime }) {
  const enabled = useUI((s) => s.settings.seasons);
  useFrame(() => {
    const w = seasonVisual;
    w.spring = w.summer = w.autumn = w.winter = 0;
    if (!enabled) w.summer = 1;
    else {
      const st = runtime.game.state;
      const b = seasonBlend(st.dayClock, frozenSeason(st));
      w[b.a] += 1 - b.k;
      w[b.b] += b.k;
    }
    const u = seasonUniforms;
    u.uSnow.value = w.winter;
    u.uWinter.value = w.winter;
    u.uAutumn.value = w.autumn;
    u.uFresh.value = w.spring;
    u.uBlossom.value = w.spring;
  }, -4);
  return null;
}

// ── falling things ──────────────────────────────────────────────────────
type Fall = "petal" | "pollen" | "leaf" | "snow";
const FALL_OF: Record<SeasonId, Fall> = { spring: "petal", summer: "pollen", autumn: "leaf", winter: "snow" };
/** How many of the slots each kind uses. */
const DENSITY: Record<Fall, number> = { petal: 0.45, pollen: 0.22, leaf: 0.55, snow: 1 };
const SLOTS = 220;
const AREA_X = 42;
const AREA_Z = 36;
const TOP = 9;

const PETALS = [new Color("#ffb7c5"), new Color("#fff0f5"), new Color("#ff8fb1")];
const LEAVES = [new Color("#f08a24"), new Color("#d9482b"), new Color("#f2c230"), new Color("#b5651d")];
const SNOW = new Color("#ffffff");
const POLLEN = new Color("#fffbe0");

const material = new MeshLambertMaterial({ side: DoubleSide });
/** A hexagon: round enough for a flake, stretched it makes a leaf. */
const geometry = new CircleGeometry(0.6, 6);
const dummy = new Object3D();

/** Wrap v into [-w/2, w/2): particles stay put in the world around the player. */
const wrap = (v: number, w: number) => ((((v % w) + w * 1.5) % w) - w / 2);

/**
 * Petals in spring, fluff in summer, leaves in autumn, snow in winter —
 * drifting around the player. During a change-over the two seasons mix.
 */
export function SeasonParticles({ runtime, quality }: { runtime: Runtime; quality: Quality }) {
  const ref = useRef<InstancedMesh>(null);
  const group = useRef<Group>(null);
  const enabled = useUI((s) => s.settings.seasons);
  const count = quality === "low" ? SLOTS / 2 : SLOTS;
  const slots = useMemo(
    () =>
      Array.from({ length: SLOTS }, (_, i) => {
        const r = mulberry32(i * 977 + 13);
        return { x: r() * AREA_X, z: r() * AREA_Z, ph: r(), sp: 0.75 + r() * 0.5, spin: (r() - 0.5) * 7, size: 0.8 + r() * 0.5, pick: r(), col: r(), rank: r() };
      }),
    [],
  );

  useFrame((state) => {
    const m = ref.current;
    const g = group.current;
    if (!m || !g) return;
    g.visible = enabled;
    if (!enabled) return;
    const b = seasonBlend(runtime.game.state.dayClock, frozenSeason(runtime.game.state));
    const t = state.clock.elapsedTime;
    const p = runtime.game.state.player;
    let n = 0;
    for (let i = 0; i < count; i++) {
      const s = slots[i];
      const kind = FALL_OF[s.pick < b.k ? b.b : b.a];
      if (s.rank > DENSITY[kind]) continue;
      let x = s.x;
      let z = s.z;
      let y: number;
      let size: number;
      if (kind === "pollen") {
        x += t * 0.35;
        z += Math.sin(t * 0.3 + s.ph * 9) * 1.2;
        y = 0.6 + s.ph * 2.6 + Math.sin(t * 0.6 + s.ph * 12) * 0.4;
        size = 0.07;
      } else {
        const fall = kind === "snow" ? 0.95 : kind === "leaf" ? 0.75 : 0.55;
        const sway = kind === "snow" ? 0.35 : kind === "leaf" ? 1.3 : 0.9;
        y = TOP - (((t * fall * s.sp) / TOP + s.ph) % 1) * TOP;
        x += Math.sin(t * 0.8 * s.sp + s.ph * 20) * sway + t * 0.25;
        z += Math.cos(t * 0.6 * s.sp + s.ph * 14) * sway * 0.6;
        size = kind === "snow" ? 0.1 : kind === "leaf" ? 0.2 : 0.14;
      }
      const dx = wrap(x - p.x, AREA_X);
      const dz = wrap(z - p.z, AREA_Z);
      // Fade out at the edges of the box and when touching the ground.
      const edge = Math.min(1, (AREA_X / 2 - Math.abs(dx)) / 3, (AREA_Z / 2 - Math.abs(dz)) / 3, y / 0.5);
      if (edge <= 0.02) continue;
      dummy.position.set(p.x + dx, y, p.z + dz);
      if (kind === "snow" || kind === "pollen") dummy.quaternion.copy(state.camera.quaternion);
      else dummy.rotation.set(t * s.spin * 0.6 + s.ph * 6, s.ph * 6, t * s.spin * 0.4);
      dummy.scale.set(size * s.size * edge, size * s.size * edge * (kind === "leaf" ? 0.65 : 1), 1);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      const color =
        kind === "petal" ? PETALS[Math.floor(s.col * PETALS.length)] : kind === "leaf" ? LEAVES[Math.floor(s.col * LEAVES.length)] : kind === "snow" ? SNOW : POLLEN;
      m.setColorAt(n, color);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[geometry, material, SLOTS]} frustumCulled={false} />
    </group>
  );
}
