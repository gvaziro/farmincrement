"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, Color, InstancedMesh, MeshLambertMaterial, Object3D, RepeatWrapping, SRGBColorSpace, type BufferGeometry, type Group } from "three";
import { mulberry32 } from "@/game/core/math";
import { CITY_BOUNDS, PAVEMENT_DZ, ROAD_DZ, ROAD_HALF } from "@/game/data/city";
import { CITY_ZONES, ZONE_D, ZONE_W, type ZoneDef } from "@/game/data/layout";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { merge, P, part, type V3 } from "../geom";
import { G, Part, mat } from "../kit";
import { windowMat } from "../nightMaterials";
import { makeSeasonal } from "../seasonLook";
import { StaticBatch } from "../StaticBatch";

const LOCKED = new Color("#a89a7d");
const ROAD = "#70757b";
const CURB = "#b9b6ad";
const OUTSIDE = "#9b9d9a";

function paverTexture(repeatX: number, repeatZ: number) {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(90,80,60,0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S / 2 - 2);
  ctx.strokeRect(1 - S / 2, S / 2 + 1, S - 2, S / 2 - 2);
  ctx.strokeRect(1 + S / 2, S / 2 + 1, S - 2, S / 2 - 2);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeatX, repeatZ);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Streets, pavements and plots: what the whole city stands on. */
export function CityGround({ runtime }: { runtime: Runtime }) {
  const rows = useMemo(() => [...new Set(CITY_ZONES.map((z) => z.gz))], []);
  const dashes = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (const gz of rows) for (let x = -120; x < 120; x += 2.6) out.push({ x, z: gz * ZONE_D + ROAD_DZ });
    return out;
  }, [rows]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow material={mat(OUTSIDE, { kind: "snow" })}>
        <planeGeometry args={[420, 420]} />
      </mesh>
      {CITY_ZONES.map((z) => (
        <Plot key={z.id} runtime={runtime} zone={z} />
      ))}
      {rows.map((gz) => (
        <Street key={gz} z={gz * ZONE_D + ROAD_DZ} />
      ))}
      {/* Avenues along the sides of the map close the street grid. */}
      {[CITY_BOUNDS.minX - 2.4, CITY_BOUNDS.maxX + 2.4].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, 0.012, (CITY_BOUNDS.minZ + CITY_BOUNDS.maxZ) / 2]} receiveShadow material={mat(ROAD, { kind: "plain" })}>
          <planeGeometry args={[4.4, CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ + 120]} />
        </mesh>
      ))}
      <Dashes items={dashes} />
      <Hoardings runtime={runtime} />
      <Skyline />
    </group>
  );
}

function Street({ z }: { z: number }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, z]} receiveShadow material={mat(ROAD, { kind: "plain" })}>
        <planeGeometry args={[260, ROAD_HALF * 2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[0, 0.03, z + s * (ROAD_HALF + 0.08)]} receiveShadow material={mat(CURB, { kind: "plain" })}>
          <planeGeometry args={[260, 0.16]} />
        </mesh>
      ))}
    </group>
  );
}

const dummy = new Object3D();

function Dashes({ items }: { items: { x: number; z: number }[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    items.forEach((it, i) => {
      dummy.position.set(it.x, 0.035, it.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, mat("#f2f0e6", { kind: "plain" }), items.length]} frustumCulled={false}>
      <planeGeometry args={[1.2, 0.13]} />
    </instancedMesh>
  );
}

let pavers: CanvasTexture | null = null;
const plotMaterials = new Map<string, MeshLambertMaterial>();

/** Kept for the whole session: the bus brings you back here again and again. */
function plotMaterial(zone: ZoneDef) {
  let m = plotMaterials.get(zone.id);
  if (!m) {
    pavers ??= paverTexture(ZONE_W / 3, ZONE_D / 3);
    // The park is lawn, not paving.
    m = makeSeasonal(new MeshLambertMaterial({ color: LOCKED.clone(), map: zone.id === "c_park" ? null : pavers }), "snow");
    plotMaterials.set(zone.id, m);
  }
  return m;
}

/** One plot: bare earth with a building site, or paving once it is ours. */
function Plot({ runtime, zone }: { runtime: Runtime; zone: ZoneDef }) {
  const material = plotMaterial(zone);
  const target = useMemo(() => new Color(zone.tint), [zone.tint]);
  useFrame((_, dt) => {
    const open = runtime.game.state.zones.has(zone.id);
    material.color.lerp(open ? target : LOCKED, Math.min(1, dt * 2.5));
  });
  const cx = zone.gx * ZONE_W;
  const cz = zone.gz * ZONE_D;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} receiveShadow material={material}>
        <planeGeometry args={[ZONE_W, ZONE_D]} />
      </mesh>
      {/* Pavement along the road. */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.012, cz + PAVEMENT_DZ + 0.05]} receiveShadow material={mat("#c9c5ba", { kind: "snow" })}>
        <planeGeometry args={[ZONE_W, 2.2]} />
      </mesh>
      <BuildingSite runtime={runtime} zone={zone} />
    </group>
  );
}

/** A crane, a heap of sand and traffic cones on a plot nobody has bought yet. */
function BuildingSite({ runtime, zone }: { runtime: Runtime; zone: ZoneDef }) {
  const g = useRef<Group>(null);
  const k = useRef(runtime.game.state.zones.has(zone.id) ? 0 : 1);
  useFrame((_, dt) => {
    const r = g.current;
    if (!r) return;
    const open = runtime.game.state.zones.has(zone.id);
    k.current = Math.max(0, Math.min(1, k.current + (open ? -dt * 2 : dt * 2)));
    r.visible = k.current > 0.001;
    r.scale.set(1, Math.max(0.001, k.current), 1);
  });
  const cx = zone.gx * ZONE_W;
  const cz = zone.gz * ZONE_D;
  const rnd = useMemo(() => mulberry32(zone.gx * 37 + zone.gz * 11 + 5), [zone.gx, zone.gz]);
  const piles = useMemo(() => Array.from({ length: 4 }, () => ({ x: (rnd() - 0.5) * 16, z: (rnd() - 0.5) * 12, s: 0.8 + rnd() * 1.4 })), [rnd]);
  const cones = useMemo(() => Array.from({ length: 7 }, () => ({ x: (rnd() - 0.5) * 20, z: (rnd() - 0.5) * 14 })), [rnd]);
  return (
    <group ref={g} position={[cx, 0, cz]}>
      <StaticBatch>
        {piles.map((p, i) => (
          <Part key={i} g={G.ico(1, 0)} c={i % 2 ? "#c9b27f" : "#a38b63"} position={[p.x, 0.25 * p.s, p.z]} scale={[p.s * 1.3, p.s * 0.55, p.s]} />
        ))}
        {cones.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]}>
            <Part g={G.box(0.4, 0.04, 0.4)} c="#3a3a3a" position={[0, 0.02, 0]} />
            <Part g={G.cone(0.16, 0.5, 6)} c="#ff7a1a" position={[0, 0.28, 0]} />
            <Part g={G.cyl(0.095, 0.115, 0.08, 6)} c="#ffffff" position={[0, 0.28, 0]} />
          </group>
        ))}
        {/* Crane */}
        <group position={[5, 0, -5]}>
          <Part g={G.box(1.6, 0.3, 1.6)} c="#6a6a6a" position={[0, 0.15, 0]} />
          <Part g={G.box(0.4, 6.4, 0.4)} c="#f2b632" position={[0, 3.4, 0]} />
          <Part g={G.box(6.6, 0.28, 0.28)} c="#f2b632" position={[-1.6, 6.5, 0]} />
          <Part g={G.box(0.9, 0.6, 0.6)} c="#4a4a4a" position={[1.5, 6.2, 0]} />
          <Part g={G.box(0.06, 2.4, 0.06)} c="#333333" position={[-3.8, 5.2, 0]} />
          <Part g={G.box(0.7, 0.3, 0.7)} c="#8a8a8a" position={[-3.8, 3.9, 0]} />
        </group>
      </StaticBatch>
    </group>
  );
}

const POST_GAP = 2.6;

/** A board fence along every edge between our land and anything else. */
function Hoardings({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const panels = useRef<InstancedMesh>(null);
  const segs = useMemo(() => {
    void structure;
    const zones = runtime.game.state.zones;
    const open = new Set(CITY_ZONES.filter((z) => zones.has(z.id)).map((z) => `${z.gx},${z.gz}`));
    const out: { x: number; z: number; yaw: number; odd: boolean }[] = [];
    const run = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.round(len / POST_GAP);
      const yaw = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        out.push({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t, yaw, odd: i % 2 === 1 });
      }
    };
    for (const key of open) {
      const [gx, gz] = key.split(",").map(Number);
      const cx = gx * ZONE_W;
      const cz = gz * ZONE_D;
      const hw = ZONE_W / 2;
      const hd = ZONE_D / 2;
      if (!open.has(`${gx},${gz - 1}`)) run(cx - hw, cz - hd, cx + hw, cz - hd);
      if (!open.has(`${gx},${gz + 1}`)) run(cx - hw, cz + hd, cx + hw, cz + hd);
      if (!open.has(`${gx - 1},${gz}`)) run(cx - hw, cz - hd, cx - hw, cz + hd);
      if (!open.has(`${gx + 1},${gz}`)) run(cx + hw, cz - hd, cx + hw, cz + hd);
    }
    return out;
  }, [runtime, structure]);

  useLayoutEffect(() => {
    const m = panels.current!;
    const white = new Color("#f4f4ee");
    const blue = new Color("#4a90d9");
    segs.forEach((s, i) => {
      dummy.position.set(s.x, 0.55, s.z);
      dummy.rotation.set(0, -s.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, s.odd ? blue : white);
    });
    m.count = segs.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [segs]);

  return <instancedMesh ref={panels} args={[G.box(POST_GAP - 0.06, 1.1, 0.1), mat("#ffffff"), 200]} castShadow receiveShadow frustumCulled={false} />;
}

// ── the rest of the city ────────────────────────────────────────────────
const WALLS = ["#c9b8a4", "#b8c4cc", "#d8c0a8", "#a8b4a0", "#c8a890", "#b0a8c0", "#d0c8b8", "#9fb0bd"];
const skyMat = makeSeasonal(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), "snow");

let skyline: { walls: BufferGeometry; windows: BufferGeometry } | null = null;

/** A ring of houses round the map: two meshes, walls and windows. */
function Skyline() {
  skyline ??= buildSkyline();
  const { walls, windows } = skyline;
  return (
    <group>
      <mesh geometry={walls} material={skyMat} castShadow={false} receiveShadow />
      <mesh geometry={windows} material={windowMat} />
    </group>
  );
}

function buildSkyline() {
    const rnd = mulberry32(77);
    const wallParts: BufferGeometry[] = [];
    const windowParts: BufferGeometry[] = [];
    const place = (x: number, z: number, w: number, d: number, h: number) => {
      const c = WALLS[Math.floor(rnd() * WALLS.length)];
      wallParts.push(part(P.box(w, h, d), c, { p: [x, h / 2, z] }));
      wallParts.push(part(P.box(w + 0.3, 0.25, d + 0.3), "#8a8780", { p: [x, h + 0.12, z] }));
      // Windows on the side that faces the camera.
      const cols = Math.max(1, Math.floor(w / 1.6));
      const rows = Math.max(1, Math.floor(h / 1.7));
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          if (rnd() < 0.18) continue;
          const wx = x + (k - (cols - 1) / 2) * 1.5;
          const wy = 1.2 + r * 1.65;
          const p: V3 = [wx, wy, z + d / 2 + 0.01];
          windowParts.push(part(P.box(0.8, 0.95, 0.04), "#ffffff", { p }));
        }
      }
    };
    const { minX, maxX, minZ, maxZ } = CITY_BOUNDS;
    // North: tall.
    for (let x = minX - 60; x < maxX + 60; x += 7 + rnd() * 4) {
      place(x, minZ - 8 - rnd() * 3, 5 + rnd() * 3, 6, 6 + rnd() * 11);
      place(x + 2, minZ - 20 - rnd() * 4, 5 + rnd() * 3, 6, 9 + rnd() * 14);
    }
    // East and west, beyond the avenues.
    for (let z = minZ - 12; z < maxZ + 34; z += 7 + rnd() * 3) {
      place(minX - 10 - rnd() * 2, z, 7, 5.6, 4 + rnd() * 9);
      place(maxX + 10 + rnd() * 2, z, 7, 5.6, 4 + rnd() * 9);
      place(minX - 22 - rnd() * 3, z + 2, 7, 5.6, 6 + rnd() * 11);
      place(maxX + 22 + rnd() * 3, z + 2, 7, 5.6, 6 + rnd() * 11);
    }
    // South: low, so the camera looks over them.
    for (let x = minX - 26; x < maxX + 26; x += 8 + rnd() * 4) place(x, maxZ + 9 + rnd() * 4, 6 + rnd() * 2, 5, 1.6 + rnd() * 1.4);
    return { walls: merge(wallParts), windows: merge(windowParts) };
}
