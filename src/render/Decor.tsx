"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D, type BufferGeometry, type Group, type Material } from "three";
import { mulberry32 } from "@/game/core/math";
import { MAP_BOUNDS, POND, ZONE_D, ZONE_W, ZONES } from "@/game/data/layout";
import type { Runtime } from "@/runtime/runtime";
import { merge, P, part } from "./geom";
import { cropGeometry } from "./models/cropModels";
import { isReserved } from "./reserved";
import { makeSeasonal, seasonVisual, type SeasonKind } from "./seasonLook";

const vmat = (kind: SeasonKind) => makeSeasonal(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), kind);
/** Leafy things change with the seasons; pines stay green; rocks only get snow. */
const FOLIAGE = vmat("foliage");
const EVERGREEN = vmat("evergreen");
const SNOWY = vmat("snow");

interface Inst {
  x: number;
  z: number;
  s: number;
  yaw: number;
  tint?: string;
}

const dummy = new Object3D();
const tmpColor = new Color();

function Instanced({ geometry, items, shadow = true, material = FOLIAGE }: { geometry: BufferGeometry; items: Inst[]; shadow?: boolean; material?: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    items.forEach((it, i) => {
      dummy.position.set(it.x, 0, it.z);
      dummy.rotation.set(0, it.yaw, 0);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, tmpColor.set(it.tint ?? "#ffffff"));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} castShadow={shadow} receiveShadow />;
}

// ── geometries ──────────────────────────────────────────────────────────
const geo = {
  pine: () =>
    merge([
      part(P.cyl(0.12, 0.18, 0.9, 6), "#7a4b2a", { p: [0, 0.45, 0] }),
      part(P.cone(1.0, 1.5, 7), "#3f8f3a", { p: [0, 1.5, 0] }),
      part(P.cone(0.8, 1.3, 7), "#4a9e40", { p: [0, 2.3, 0] }),
      part(P.cone(0.55, 1.0, 7), "#57ad46", { p: [0, 3.0, 0] }),
    ]),
  round: () => merge([cropGeometry("treeTrunk"), cropGeometry("appleCanopy")]),
  bush: () =>
    merge([
      part(P.ico(0.45, 0), "#4fae3a", { p: [0, 0.32, 0], s: [1, 0.8, 1] }),
      part(P.ico(0.32, 0), "#5fbe45", { p: [0.35, 0.25, 0.1] }),
      part(P.ico(0.28, 0), "#45a035", { p: [-0.3, 0.22, -0.1] }),
    ]),
  rock: () =>
    merge([
      part(P.ico(0.38, 0), "#a7a39a", { p: [0, 0.18, 0], s: [1.2, 0.6, 1] }),
      part(P.ico(0.2, 0), "#bab6ac", { p: [0.35, 0.1, 0.15], s: [1, 0.7, 1] }),
    ]),
  tuft: () => cropGeometry("grass"),
  flower: (petal: string) =>
    merge([
      part(P.cyl(0.015, 0.015, 0.3, 4), "#4f9e38", { p: [0, 0.15, 0] }),
      ...[0, 1, 2, 3, 4].map((i) =>
        part(P.sphere(0.055, 5, 3), petal, { p: [Math.cos(i * 1.256) * 0.07, 0.31, Math.sin(i * 1.256) * 0.07], s: [1, 0.5, 1] }),
      ),
      part(P.sphere(0.04, 5, 3), "#ffd23f", { p: [0, 0.33, 0] }),
    ]),
  reed: () =>
    merge([
      part(P.cyl(0.02, 0.025, 0.9, 4), "#6f9e3a", { p: [0, 0.45, 0] }),
      part(P.cyl(0.04, 0.04, 0.2, 5), "#7a4b2a", { p: [0, 0.85, 0] }),
      part(P.cone(0.05, 0.6, 3), "#5f9e3a", { p: [0.1, 0.3, 0], r: [0, 0, -0.3] }),
    ]),
  lily: () =>
    merge([
      part(P.cyl(0.32, 0.32, 0.03, 8), "#3f9b2f"),
      part(P.sphere(0.07, 5, 3), "#ffb3c7", { p: [0.08, 0.05, 0.05] }),
    ]),
};

function useGeo<K extends keyof typeof geo>(k: K, arg?: string) {
  return useMemo(() => (arg ? (geo[k] as (a: string) => BufferGeometry)(arg) : (geo[k] as () => BufferGeometry)()), [k, arg]);
}

// ── layout ──────────────────────────────────────────────────────────────
function scatter() {
  const rnd = mulberry32(2024);
  const pines: Inst[] = [];
  const rounds: Inst[] = [];
  const bushes: Inst[] = [];
  const rocks: Inst[] = [];
  const tufts: Inst[] = [];
  const flowers: Record<string, Inst[]> = { "#ff6b8a": [], "#ffffff": [], "#b98cff": [], "#ffb347": [] };
  const pondReeds: Inst[] = [];
  const lilies: Inst[] = [];

  const greens = ["#ffffff", "#e6ffd9", "#d4f0c4", "#fff6d9"];
  const tree = (x: number, z: number, big = 1) => {
    const inst: Inst = { x, z, s: (0.8 + rnd() * 0.6) * big, yaw: rnd() * 6.28, tint: greens[Math.floor(rnd() * greens.length)] };
    (rnd() < 0.55 ? pines : rounds).push(inst);
  };

  // Forest ring around the map.
  const pad = 1.6;
  const ring = { x0: MAP_BOUNDS.minX - 39, x1: MAP_BOUNDS.maxX + 39, z0: MAP_BOUNDS.minZ - 37, z1: MAP_BOUNDS.maxZ + 25 };
  const count = Math.round((520 * ((ring.x1 - ring.x0) * (ring.z1 - ring.z0))) / (156 * 128));
  for (let i = 0; i < count; i++) {
    const x = ring.x0 + rnd() * (ring.x1 - ring.x0);
    const z = ring.z0 + rnd() * (ring.z1 - ring.z0);
    const inside = x > MAP_BOUNDS.minX - pad && x < MAP_BOUNDS.maxX + pad && z > MAP_BOUNDS.minZ - pad && z < MAP_BOUNDS.maxZ + pad;
    if (inside) continue;
    // Thin out in front of the camera so the south edge stays readable.
    if (z > MAP_BOUNDS.maxZ && rnd() < 0.55) continue;
    tree(x, z, 1.1);
  }

  // Reeds along the pond's quiet edges (not the fishing shore) and lily pads.
  const W = POND.water;
  for (let i = 0; i < 30; i++) {
    const side = i % 3;
    const t = rnd();
    const x = side === 0 ? W.x0 + 0.3 + rnd() * 0.5 : W.x0 + 0.8 + t * (W.x1 - W.x0 - 3.5);
    const z = side === 0 ? W.z0 + 0.5 + t * (W.z1 - W.z0 - 1) : side === 1 ? W.z0 + 0.3 + rnd() * 0.4 : W.z1 - 0.3 - rnd() * 0.4;
    pondReeds.push({ x, z, s: 0.8 + rnd() * 0.5, yaw: rnd() * 6.28 });
  }
  for (let i = 0; i < 9; i++) {
    const x = W.x0 + 1 + rnd() * 3.6;
    const z = rnd() < 0.5 ? W.z0 + 1 + rnd() * 6 : W.z1 - 1 - rnd() * 6;
    lilies.push({ x, z, s: 0.7 + rnd() * 0.6, yaw: rnd() * 6.28 });
  }

  // Forest plots are clearings: a fringe of trees stays along the map edge.
  const hasZone = (gx: number, gz: number) => ZONES.some((z) => z.gx === gx && z.gz === gz);
  for (const z of ZONES) {
    if (z.wild !== "forest") continue;
    const cx = z.gx * ZONE_W;
    const cz = z.gz * ZONE_D;
    const west = !hasZone(z.gx - 1, z.gz);
    const north = !hasZone(z.gx, z.gz - 1);
    if (!west && !north) continue;
    for (let i = 0; i < 46; i++) {
      const alongX = north && (!west || rnd() < 0.5);
      const x = alongX ? cx + (rnd() - 0.5) * (ZONE_W - 2) : cx - ZONE_W / 2 + 1 + rnd() * 2.2;
      const zz = alongX ? cz - ZONE_D / 2 + 1 + rnd() * 2.2 : cz + (rnd() - 0.5) * (ZONE_D - 2);
      if (isReserved(x, zz, 1)) continue;
      tree(x, zz, 0.95);
    }
  }

  // Sprinkle details on playable plots, avoiding gameplay areas and fences.
  for (const z of ZONES) {
    const cx = z.gx * ZONE_W;
    const cz = z.gz * ZONE_D;
    const place = (n: number, list: Inst[], scale: [number, number], margin = 1.4) => {
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - 0.5) * (ZONE_W - margin * 2);
        const zz = cz + (rnd() - 0.5) * (ZONE_D - margin * 2);
        if (isReserved(x, zz, 0.3)) continue;
        list.push({ x, z: zz, s: scale[0] + rnd() * (scale[1] - scale[0]), yaw: rnd() * 6.28 });
      }
    };
    place(10, bushes, [0.7, 1.2]);
    place(6, rocks, [0.6, 1.2]);
    place(40, tufts, [0.6, 1.0], 0.8);
    const colors = Object.keys(flowers);
    for (let i = 0; i < 26; i++) {
      const c = colors[Math.floor(rnd() * colors.length)];
      place(1, flowers[c], [0.8, 1.2], 0.8);
    }
  }

  return { pines, rounds, bushes, rocks, tufts, flowers, pondReeds, lilies };
}

/**
 * Overgrowth on locked plots — shrinks away when the land is bought. A
 * "forest" plot is covered in trees that get cleared on purchase.
 */
function wildFor(zone: (typeof ZONES)[number]) {
  const rnd = mulberry32(zone.gx * 31 + zone.gz * 7 + 99);
  const bushes: Inst[] = [];
  const tufts: Inst[] = [];
  const pines: Inst[] = [];
  const rounds: Inst[] = [];
  const cx = zone.gx * ZONE_W;
  const cz = zone.gz * ZONE_D;
  const forest = zone.wild === "forest";
  const greens = ["#ffffff", "#e6ffd9", "#d4f0c4", "#fff6d9"];
  for (let i = 0; i < (forest ? 90 : 60); i++) {
    const x = cx + (rnd() - 0.5) * (ZONE_W - 1.5);
    const z = cz + (rnd() - 0.5) * (ZONE_D - 1.5);
    if (inWater(x, z, 0.6)) continue;
    const roll = rnd();
    if (forest && roll < 0.55) {
      (rnd() < 0.55 ? pines : rounds).push({ x, z, s: 0.85 + rnd() * 0.55, yaw: rnd() * 6.28, tint: greens[Math.floor(rnd() * greens.length)] });
    } else if (roll < (forest ? 0.8 : 0.3)) bushes.push({ x, z, s: 0.8 + rnd() * 0.7, yaw: rnd() * 6.28 });
    else tufts.push({ x, z, s: 1.1 + rnd() * 0.8, yaw: rnd() * 6.28 });
  }
  return { bushes, tufts, pines, rounds };
}

const inWater = (x: number, z: number, pad = 0) =>
  x > POND.water.x0 - pad && x < POND.water.x1 + pad && z > POND.water.z0 - pad && z < POND.water.z1 + pad;

export function Decor({ runtime }: { runtime: Runtime }) {
  const d = useMemo(() => scatter(), []);
  const pine = useGeo("pine");
  const round = useGeo("round");
  const bush = useGeo("bush");
  const rock = useGeo("rock");
  const tuft = useGeo("tuft");
  const reed = useGeo("reed");
  const lily = useGeo("lily");
  const flowerGeos = {
    "#ff6b8a": useGeo("flower", "#ff6b8a"),
    "#ffffff": useGeo("flower", "#ffffff"),
    "#b98cff": useGeo("flower", "#b98cff"),
    "#ffb347": useGeo("flower", "#ffb347"),
  } as Record<string, BufferGeometry>;

  const flowers = useRef<Group>(null);
  const lilies = useRef<Group>(null);
  useFrame(() => {
    // Flowers sink into the snow; lily pads vanish under the ice.
    const w = seasonVisual.winter;
    if (flowers.current) {
      flowers.current.scale.y = Math.max(0.001, 1 - w);
      flowers.current.visible = w < 0.99;
    }
    if (lilies.current) lilies.current.visible = w < 0.3;
  });

  return (
    <group>
      <Instanced geometry={pine} items={d.pines} material={EVERGREEN} />
      <Instanced geometry={round} items={d.rounds} />
      <Instanced geometry={bush} items={d.bushes} />
      <Instanced geometry={rock} items={d.rocks} material={SNOWY} />
      <Instanced geometry={tuft} items={d.tufts} shadow={false} />
      <group ref={flowers}>
        {Object.entries(d.flowers).map(([c, list]) => (
          <Instanced key={c} geometry={flowerGeos[c]} items={list} shadow={false} />
        ))}
      </group>
      <Instanced geometry={reed} items={d.pondReeds} />
      <group ref={lilies}>
        <Instanced geometry={lily} items={d.lilies} shadow={false} />
      </group>
      {ZONES.filter((z) => z.id !== "farm").map((z) => (
        <Wild key={z.id} runtime={runtime} zone={z} bush={bush} tuft={tuft} pine={pine} round={round} />
      ))}
    </group>
  );
}

function Wild({
  runtime,
  zone,
  bush,
  tuft,
  pine,
  round,
}: {
  runtime: Runtime;
  zone: (typeof ZONES)[number];
  bush: BufferGeometry;
  tuft: BufferGeometry;
  pine: BufferGeometry;
  round: BufferGeometry;
}) {
  const w = useMemo(() => wildFor(zone), [zone]);
  const group = useRef<Group>(null);
  const k = useRef(runtime.game.state.zones.has(zone.id) ? 0 : 1);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const open = runtime.game.state.zones.has(zone.id);
    k.current = Math.max(0, Math.min(1, k.current + (open ? -dt * 1.6 : dt * 2)));
    g.visible = k.current > 0.001;
    g.scale.set(1, k.current, 1);
  });
  return (
    <group ref={group}>
      <Instanced geometry={bush} items={w.bushes} />
      <Instanced geometry={tuft} items={w.tufts} shadow={false} />
      {w.pines.length > 0 && <Instanced geometry={pine} items={w.pines} material={EVERGREEN} />}
      {w.rounds.length > 0 && <Instanced geometry={round} items={w.rounds} />}
    </group>
  );
}
