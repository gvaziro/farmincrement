"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, MeshLambertMaterial, TubeGeometry, Vector3, type BufferGeometry, type Group } from "three";
import { FARMHOUSE, MARKET } from "@/game/data/layout";
import type { SeasonId } from "@/game/engine/seasons";
import { merge, P, part } from "./geom";
import { G, Part, mat } from "./kit";
import { bulbMats, lanternMat } from "./nightMaterials";
import { seasonVisual } from "./seasonLook";
import { StaticBatch } from "./StaticBatch";

type V3 = [number, number, number];

/** Garlands: in front of the market awning and under the farmhouse eaves. */
const GARLANDS: { a: V3; b: V3; n: number }[] = [
  { a: [MARKET.x - 2.2, 2.28, MARKET.z + 1.58], b: [MARKET.x + 2.2, 2.28, MARKET.z + 1.58], n: 11 },
  { a: [FARMHOUSE.x - 2.0, 2.2, FARMHOUSE.z + 1.82], b: [FARMHOUSE.x + 2.0, 2.2, FARMHOUSE.z + 1.82], n: 10 },
];
const SAG = 0.26;
/** Two corners in front of the farmhouse for each season's centrepieces. */
const LEFT: V3 = [FARMHOUSE.x - 2.3, 0, FARMHOUSE.z + 3.4];
const RIGHT: V3 = [FARMHOUSE.x + 3.6, 0, FARMHOUSE.z + 4.2];

const DECO = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const FLAGS = ["#ff5d73", "#ffd23f", "#3fa7ff", "#4fd16b", "#b06cff", "#ff9f1c"];
const LEAVES = ["#f08a24", "#d9482b", "#f2c230"];

const at = (g: (typeof GARLANDS)[number], t: number): V3 => [
  g.a[0] + (g.b[0] - g.a[0]) * t,
  g.a[1] + (g.b[1] - g.a[1]) * t - SAG * 4 * t * (1 - t),
  g.a[2] + (g.b[2] - g.a[2]) * t,
];

/** Each garland as a sagging string. */
function strings(): BufferGeometry[] {
  return GARLANDS.map((g) => {
    const pts = Array.from({ length: 9 }, (_, i) => new Vector3(...at(g, i / 8)));
    return new TubeGeometry(new CatmullRomCurve3(pts), 24, 0.018, 4, false);
  });
}

/** Ornament positions along all garlands. */
function ornaments() {
  const out: { p: V3; i: number }[] = [];
  for (const g of GARLANDS) for (let i = 0; i < g.n; i++) out.push({ p: at(g, (i + 0.5) / g.n), i });
  return out;
}

/** All the ornaments of one season merged into one geometry. */
function ornamentGeometry(season: SeasonId): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const { p, i } of ornaments()) {
    const [x, y, z] = p;
    if (season === "spring") {
      const c = i % 2 ? "#ffffff" : "#ff8fb1";
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        parts.push(part(P.sphere(0.045, 5, 3), c, { p: [x + Math.cos(a) * 0.06, y - 0.08 + Math.sin(a) * 0.06, z + 0.01], s: [1, 1, 0.5] }));
      }
      parts.push(part(P.sphere(0.035, 5, 3), "#ffd23f", { p: [x, y - 0.08, z + 0.03] }));
    } else if (season === "summer") {
      parts.push(part(P.cone(0.13, 0.26, 3), FLAGS[i % FLAGS.length], { p: [x, y - 0.13, z], r: [Math.PI, Math.PI / 6, 0], s: [1, 1, 0.25] }));
    } else if (i % 3 === 1) {
      parts.push(part(P.sphere(0.08, 6, 4), "#f28c28", { p: [x, y - 0.1, z], s: [1, 0.8, 1] }));
      parts.push(part(P.cyl(0.012, 0.012, 0.05, 4), "#5a7a2a", { p: [x, y - 0.03, z] }));
    } else {
      parts.push(part(P.box(0.14, 0.2, 0.02), LEAVES[i % LEAVES.length], { p: [x, y - 0.11, z], r: [0, 0, i % 2 ? 0.5 : -0.5] }));
    }
  }
  return merge(parts);
}

/** Glowing bulbs at the given points: one merged geometry per colour. */
function bulbGeometries(points: V3[], size = 0.055): BufferGeometry[] {
  const by: BufferGeometry[][] = bulbMats.map(() => []);
  points.forEach((p, i) => by[i % bulbMats.length].push(part(P.sphere(size, 6, 4), "#ffffff", { p, s: [1, 1.25, 1] })));
  return by.map((list) => merge(list));
}

/** Winter: string lights on the garlands and around the fir. */
function winterLights(): V3[] {
  const pts: V3[] = ornaments().map(({ p }) => [p[0], p[1] - 0.07, p[2]]);
  for (const [y, r, n] of [
    [0.45, 0.62, 7],
    [1.0, 0.48, 6],
    [1.55, 0.32, 5],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + y;
      pts.push([LEFT[0] + Math.cos(a) * r, y, LEFT[2] + Math.sin(a) * r]);
    }
  }
  return pts;
}

/**
 * Seasonal decorations around the farmhouse and the market: flower garlands
 * in spring, flags in summer, leaves and pumpkins in autumn, a decorated fir,
 * a snowman and coloured lights in winter. Sets swap at night, with the season.
 */
export function Festive() {
  const string = useMemo(() => strings(), []);
  return (
    <group>
      <SeasonSet season="spring" string={string} />
      <SeasonSet season="summer" string={string} />
      <SeasonSet season="autumn" string={string} />
      <SeasonSet season="winter" string={string} />
    </group>
  );
}

function SeasonSet({ season, string }: { season: SeasonId; string: BufferGeometry[] }) {
  const ref = useRef<Group>(null);
  const deco = useMemo(() => (season === "winter" ? null : ornamentGeometry(season)), [season]);
  const bulbs = useMemo(() => (season === "winter" ? bulbGeometries(winterLights()) : null), [season]);
  useFrame(() => {
    if (ref.current) ref.current.visible = seasonVisual[season] >= 0.5;
  });
  const winter = season === "winter";
  return (
    <group ref={ref}>
      <StaticBatch>
        {string.map((g, i) => (
          <mesh key={i} geometry={g} material={mat(winter ? "#2f4a2f" : "#6b4a2a", { kind: "plain" })} />
        ))}
        {deco && <mesh geometry={deco} material={DECO} castShadow />}
        <group position={LEFT}>{season === "spring" ? <FlowerTub /> : season === "summer" ? <Sunflowers /> : season === "autumn" ? <Scarecrow /> : <FirTree />}</group>
        <group position={RIGHT}>{season === "spring" ? <FlowerTub /> : season === "summer" ? <Sunflowers /> : season === "autumn" ? <HayBale /> : <Snowman />}</group>
      </StaticBatch>
      {bulbs?.map((g, i) => (
        <mesh key={i} geometry={g} material={bulbMats[i]} />
      ))}
      {winter && <mesh geometry={G.dodeca(0.16)} material={lanternMat} position={[LEFT[0], 2.25, LEFT[2]]} />}
    </group>
  );
}

// ── centrepieces ────────────────────────────────────────────────────────
function FlowerTub() {
  const colors = ["#ff5d73", "#ffd23f", "#b06cff", "#ffffff", "#ff8fb1"];
  return (
    <group>
      <Part g={G.cyl(0.42, 0.34, 0.45, 8)} c="#a8642a" position={[0, 0.22, 0]} />
      <Part g={G.cyl(0.44, 0.44, 0.06, 8)} c="#8a5a33" position={[0, 0.45, 0]} />
      <Part g={G.cyl(0.38, 0.38, 0.04, 8)} c="#6b4a2a" position={[0, 0.44, 0]} />
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2]}>
            <Part g={G.cyl(0.015, 0.015, 0.35, 4)} c="#4f9e38" position={[0, 0.17, 0]} />
            <Part g={G.cone(0.07, 0.14, 6)} c={c} position={[0, 0.4, 0]} rotation={[Math.PI, 0, 0]} />
          </group>
        );
      })}
    </group>
  );
}

function Sunflowers() {
  return (
    <group>
      <Part g={G.box(0.8, 0.35, 0.5)} c="#c98b52" position={[0, 0.17, 0]} />
      {[-0.22, 0.05, 0.28].map((x, i) => {
        const h = 1.0 + i * 0.15;
        return (
          <group key={x} position={[x, 0.35, (i - 1) * 0.08]}>
            <Part g={G.cyl(0.025, 0.03, h, 5)} c="#4f9e38" position={[0, h / 2, 0]} />
            <group position={[0, h, 0.04]} rotation={[0.35, 0, 0]}>
              <Part g={G.cyl(0.2, 0.2, 0.04, 10)} c="#ffd23f" rotation={[Math.PI / 2, 0, 0]} />
              <Part g={G.cyl(0.1, 0.1, 0.06, 8)} c="#7a4b26" rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} />
            </group>
            <Part g={G.cone(0.08, 0.2, 4)} c="#5fae45" position={[0.08, 0.45, 0]} rotation={[0, 0, -1.0]} />
          </group>
        );
      })}
    </group>
  );
}

function Scarecrow() {
  return (
    <group rotation={[0, 0.3, 0]}>
      <Part g={G.box(0.08, 1.5, 0.08)} c="#7a4b26" position={[0, 0.75, 0]} />
      <Part g={G.box(1.1, 0.07, 0.07)} c="#7a4b26" position={[0, 1.15, 0]} />
      <Part g={G.box(0.5, 0.55, 0.28)} c="#d9482b" position={[0, 1.05, 0]} />
      <Part g={G.box(0.52, 0.06, 0.3)} c="#f2c230" position={[0, 0.95, 0]} />
      <Part g={G.box(0.16, 0.14, 0.16)} c="#d9482b" position={[-0.45, 1.13, 0]} />
      <Part g={G.box(0.16, 0.14, 0.16)} c="#d9482b" position={[0.45, 1.13, 0]} />
      <Part g={G.cone(0.08, 0.16, 5)} c="#f2c94c" position={[-0.6, 1.13, 0]} rotation={[0, 0, Math.PI / 2]} />
      <Part g={G.cone(0.08, 0.16, 5)} c="#f2c94c" position={[0.6, 1.13, 0]} rotation={[0, 0, -Math.PI / 2]} />
      <Part g={G.sphere(0.2, 8, 6)} c="#e8d4a8" position={[0, 1.5, 0]} />
      <Part g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[-0.07, 1.54, 0.18]} />
      <Part g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[0.07, 1.54, 0.18]} />
      <Part g={G.cyl(0.32, 0.32, 0.03, 10)} c="#f2c94c" position={[0, 1.66, 0]} />
      <Part g={G.cyl(0.15, 0.19, 0.16, 8)} c="#f2c94c" position={[0, 1.74, 0]} />
    </group>
  );
}

function HayBale() {
  return (
    <group rotation={[0, -0.4, 0]}>
      <Part g={G.box(0.9, 0.5, 0.55)} c="#e8d06a" position={[0, 0.25, 0]} />
      <Part g={G.box(0.92, 0.05, 0.57)} c="#c9a640" position={[0, 0.15, 0]} />
      <Part g={G.box(0.92, 0.05, 0.57)} c="#c9a640" position={[0, 0.35, 0]} />
      <Part g={G.sphere(0.2, 8, 6)} c="#f28c28" position={[-0.15, 0.62, 0]} scale={[1, 0.8, 1]} />
      <Part g={G.cyl(0.02, 0.025, 0.08, 4)} c="#5a7a2a" position={[-0.15, 0.8, 0]} />
      <Part g={G.sphere(0.16, 8, 6)} c="#e07a1c" position={[0.5, 0.13, 0.35]} scale={[1, 0.8, 1]} />
      <Part g={G.sphere(0.12, 8, 6)} c="#f59a35" position={[0.25, 0.1, 0.45]} scale={[1, 0.8, 1]} />
    </group>
  );
}

function FirTree() {
  return (
    <group>
      <Part g={G.cyl(0.08, 0.1, 0.35, 6)} c="#7a4b2a" position={[0, 0.17, 0]} />
      <Part g={G.cone(0.75, 0.9, 8)} c="#2f7d32" position={[0, 0.75, 0]} />
      <Part g={G.cone(0.58, 0.8, 8)} c="#3f8f3a" position={[0, 1.3, 0]} />
      <Part g={G.cone(0.4, 0.7, 8)} c="#4a9e40" position={[0, 1.8, 0]} />
    </group>
  );
}

function Snowman() {
  return (
    <group rotation={[0, -0.3, 0]}>
      <Part g={G.sphere(0.42, 10, 8)} c="#f4f8fc" position={[0, 0.38, 0]} />
      <Part g={G.sphere(0.3, 10, 8)} c="#f4f8fc" position={[0, 0.9, 0]} />
      <Part g={G.sphere(0.21, 10, 8)} c="#f4f8fc" position={[0, 1.3, 0]} />
      <Part g={G.cone(0.04, 0.22, 6)} c="#ff8a1a" position={[0, 1.3, 0.28]} rotation={[Math.PI / 2, 0, 0]} />
      <Part g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[-0.07, 1.37, 0.18]} />
      <Part g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[0.07, 1.37, 0.18]} />
      {[0.95, 0.82, 0.69].map((y) => (
        <Part key={y} g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[0, y, 0.29]} />
      ))}
      <Part g={G.cyl(0.24, 0.24, 0.07, 10)} c="#d9485f" position={[0, 1.12, 0]} />
      <Part g={G.box(0.08, 0.28, 0.05)} c="#d9485f" position={[0.12, 0.98, 0.22]} rotation={[0, 0, -0.2]} />
      <Part g={G.cyl(0.18, 0.18, 0.04, 10)} c="#2b2b2b" position={[0, 1.47, 0]} />
      <Part g={G.cyl(0.12, 0.13, 0.22, 10)} c="#2b2b2b" position={[0, 1.6, 0]} />
      <Part g={G.box(0.03, 0.4, 0.03)} c="#7a4b2a" position={[-0.38, 0.95, 0]} rotation={[0, 0, 0.9]} />
      <Part g={G.box(0.03, 0.4, 0.03)} c="#7a4b2a" position={[0.38, 0.95, 0]} rotation={[0, 0, -0.9]} />
    </group>
  );
}
