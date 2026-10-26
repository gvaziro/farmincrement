"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BoxGeometry, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, MeshLambertMaterial, Object3D, RingGeometry, Vector3, type BufferGeometry, type Group, type InstancedMesh, type Mesh } from "three";
import { merge } from "./geom";
import { mulberry32 } from "@/game/core/math";
import { frozenSeason } from "@/game/engine/challenges";
import { rainbowAt, weatherAt } from "@/game/engine/weather";
import type { Runtime } from "@/runtime/runtime";
import { useUI, type Quality } from "@/runtime/store";
import { fx } from "./fx";

/**
 * What the sky is doing, for the lights and the sound: rain / fog / snowfall
 * intensity (0 … 1) and the rainbow. Written every frame by <WeatherFX>.
 */
export const weatherVisual = { rain: 0, fog: 0, snow: 0, rainbow: 0 };

const DROPS = 650;
const FLAKES = 420;
const AREA_X = 34;
const AREA_Z = 30;
const TOP = 11;

const dropGeo = new BoxGeometry(0.03, 0.6, 0.03);
const dropMat = new MeshBasicMaterial({ color: "#d3e6f7", transparent: true, opacity: 0.55, depthWrite: false });
const flakeGeo = new CircleGeometry(0.6, 6);
const flakeMat = new MeshLambertMaterial({ color: "#ffffff", side: DoubleSide });
const dummy = new Object3D();
const wrap = (v: number, w: number) => ((((v % w) + w * 1.5) % w) - w / 2);

/** Rain streaks, splashes, heavy snowfall and the rainbow, around the player. */
export function WeatherFX({ runtime, quality }: { runtime: Runtime; quality: Quality }) {
  const drops = useRef<InstancedMesh>(null);
  const flakes = useRef<InstancedMesh>(null);
  const enabled = useUI((s) => s.settings.seasons);
  const scale = quality === "low" ? 0.5 : 1;
  const seeds = useMemo(() => {
    const r = mulberry32(4242);
    return Array.from({ length: Math.max(DROPS, FLAKES) }, () => ({ x: r() * AREA_X, z: r() * AREA_Z, ph: r(), sp: 0.85 + r() * 0.3, sway: r() * 6.28 }));
  }, []);
  const splashT = useRef(0);

  useFrame((state, dt) => {
    const dm = drops.current;
    const fm = flakes.current;
    if (!dm || !fm) return;
    const clock = runtime.game.state.dayClock;
    const frozen = frozenSeason(runtime.game.state);
    const w = enabled ? weatherAt(clock, frozen) : { kind: "clear" as const, k: 0 };
    const v = weatherVisual;
    v.rain = w.kind === "rain" ? w.k : 0;
    v.fog = w.kind === "fog" ? w.k : 0;
    v.snow = w.kind === "snow" ? w.k : 0;
    v.rainbow = enabled ? rainbowAt(clock, frozen) : 0;
    const t = state.clock.elapsedTime;
    const p = runtime.game.state.player;

    // Rain: fast slanted streaks.
    const nd = Math.floor(DROPS * scale * v.rain);
    for (let i = 0; i < nd; i++) {
      const s = seeds[i];
      const y = TOP - (((t * 13 * s.sp) / TOP + s.ph) % 1) * TOP;
      const fall = TOP - y;
      const dx = wrap(s.x + fall * 0.18 - p.x, AREA_X);
      const dz = wrap(s.z - p.z, AREA_Z);
      dummy.position.set(p.x + dx, y, p.z + dz);
      dummy.rotation.set(0, 0, 0.17);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      dm.setMatrixAt(i, dummy.matrix);
    }
    dm.count = nd;
    dm.instanceMatrix.needsUpdate = true;
    // Splashes on the ground.
    if (v.rain > 0.2) {
      splashT.current += dt * 40 * v.rain * scale;
      while (splashT.current > 1) {
        splashT.current -= 1;
        fx.splash(p.x + (Math.random() - 0.5) * 26, p.z + (Math.random() - 0.5) * 20);
      }
    }

    // Snowfall: big slow flakes swaying in the wind.
    const nf = Math.floor(FLAKES * scale * v.snow);
    for (let i = 0; i < nf; i++) {
      const s = seeds[i];
      const y = TOP - (((t * 1.3 * s.sp) / TOP + s.ph) % 1) * TOP;
      const dx = wrap(s.x + Math.sin(t * 0.7 + s.sway) * 1.2 + t * 0.6 - p.x, AREA_X);
      const dz = wrap(s.z + Math.cos(t * 0.5 + s.sway) * 0.8 - p.z, AREA_Z);
      dummy.position.set(p.x + dx, y, p.z + dz);
      dummy.quaternion.copy(state.camera.quaternion);
      dummy.scale.setScalar(0.16 * Math.min(1, y / 0.4));
      dummy.updateMatrix();
      fm.setMatrixAt(i, dummy.matrix);
    }
    fm.count = nf;
    fm.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={drops} args={[dropGeo, dropMat, DROPS]} frustumCulled={false} renderOrder={5} />
      <instancedMesh ref={flakes} args={[flakeGeo, flakeMat, FLAKES]} frustumCulled={false} />
      <Rainbow />
    </group>
  );
}

// ── rainbow ─────────────────────────────────────────────────────────────
const BANDS = ["#ff4d4d", "#ff9f1c", "#ffe14d", "#5ed35e", "#4fb3ff", "#5d6bff", "#b06cff"];

/** Seven coloured rings merged into one half-ring geometry. */
function rainbowGeometry(): BufferGeometry {
  const inner = 6.6;
  const band = 0.28;
  const parts = BANDS.map((c, i) => {
    const r0 = inner + (BANDS.length - 1 - i) * band;
    const g = new RingGeometry(r0, r0 + band, 48, 1, 0, Math.PI).toNonIndexed();
    const col = new Color(c);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) colors.set([col.r, col.g, col.b], k * 3);
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.deleteAttribute("uv");
    return g;
  });
  return merge(parts);
}

const rainbowMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false });
const ahead = new Vector3();

/**
 * After a spring or summer shower: a soft rainbow standing across the view.
 * The camera looks steeply down, so it is placed in front of the camera, in a
 * plane facing it, rather than at the far horizon nobody can see.
 */
function Rainbow() {
  const mesh = useRef<Mesh>(null);
  const group = useRef<Group>(null);
  const geometry = useMemo(() => rainbowGeometry(), []);
  useFrame((state) => {
    const m = mesh.current;
    const g = group.current;
    if (!m || !g) return;
    const k = weatherVisual.rainbow;
    g.visible = k > 0.01;
    if (!g.visible) return;
    rainbowMat.opacity = 0.32 * k;
    const cam = state.camera;
    cam.getWorldDirection(ahead);
    g.position.copy(cam.position).addScaledVector(ahead, 24);
    g.quaternion.copy(cam.quaternion);
    m.position.set(0, -1.1, 0);
  });
  return (
    <group ref={group}>
      <mesh ref={mesh} geometry={geometry} material={rainbowMat} renderOrder={6} />
    </group>
  );
}
