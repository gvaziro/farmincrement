/** Instanced plant geometries (full-grown size, origin at the ground). */
import { TorusGeometry, type BufferGeometry } from "three";
import { mulberry32 } from "@/game/core/math";
import { merge, P, part } from "../geom";

function wheat() {
  const rnd = mulberry32(7);
  const parts: BufferGeometry[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const r = i === 0 ? 0 : 0.1 + rnd() * 0.22;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.62 + rnd() * 0.26;
    const tilt: [number, number, number] = [z * 0.55, 0, -x * 0.55];
    parts.push(part(P.cyl(0.02, 0.026, h, 4), "#d6b94e", { p: [x, h / 2, z], r: tilt }));
    parts.push(part(P.sphere(0.07, 5, 4), i % 3 ? "#f5cd4f" : "#ffd966", { p: [x * 1.28, h + 0.08, z * 1.28], s: [1, 2.3, 1], r: tilt }));
  }
  parts.push(part(P.cone(0.07, 0.36, 4), "#a8c94a", { p: [0.08, 0.17, 0.05], r: [0.35, 0, -0.45] }));
  parts.push(part(P.cone(0.07, 0.34, 4), "#a8c94a", { p: [-0.09, 0.16, -0.04], r: [-0.35, 0, 0.45] }));
  parts.push(part(P.cone(0.06, 0.3, 4), "#9fbf45", { p: [0.02, 0.15, -0.1], r: [-0.45, 0, -0.1] }));
  return merge(parts);
}

function corn() {
  return merge([
    part(P.cyl(0.035, 0.05, 1.15, 5), "#5aa83f", { p: [0, 0.575, 0] }),
    part(P.cone(0.07, 0.55, 4), "#6cc24a", { p: [0.17, 0.5, 0], r: [0, 0, -0.9] }),
    part(P.cone(0.07, 0.55, 4), "#5fae45", { p: [-0.17, 0.62, 0.02], r: [0, 0, 0.9] }),
    part(P.cone(0.06, 0.45, 4), "#6cc24a", { p: [0, 0.8, 0.15], r: [0.9, 0, 0] }),
    part(P.cone(0.06, 0.4, 4), "#5fae45", { p: [0, 0.35, -0.15], r: [-0.9, 0, 0] }),
    part(P.cyl(0.06, 0.06, 0.22, 6), "#ffd23f", { p: [0.09, 0.7, 0.05], r: [0, 0, -0.35] }),
    part(P.cone(0.07, 0.16, 5), "#8fd14f", { p: [0.05, 0.58, 0.04], r: [0, 0, -0.35 + Math.PI] }),
    part(P.cone(0.05, 0.22, 4), "#d9c56a", { p: [0, 1.25, 0] }),
  ]);
}

function grass() {
  const rnd = mulberry32(11);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.08 + rnd() * 0.08;
    const h = 0.32 + rnd() * 0.2;
    parts.push(
      part(P.cone(0.06, h, 4), i % 2 ? "#6cc24a" : "#8fd14f", {
        p: [Math.cos(a) * r, h / 2, Math.sin(a) * r],
        r: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35],
      }),
    );
  }
  parts.push(part(P.sphere(0.05, 5, 3), "#ffffff", { p: [0.05, 0.42, 0.02] }));
  parts.push(part(P.sphere(0.03, 5, 3), "#ffd23f", { p: [0.05, 0.45, 0.02] }));
  return merge(parts);
}

function tomatoBush() {
  return merge([
    part(P.cyl(0.015, 0.015, 0.75, 4), "#9c6b3a", { p: [0.05, 0.37, -0.05] }),
    part(P.ico(0.26, 0), "#3f9b2f", { p: [0, 0.32, 0], s: [1, 0.9, 1] }),
    part(P.ico(0.18, 0), "#4fae3a", { p: [0.08, 0.55, 0.04] }),
    part(P.ico(0.15, 0), "#4fae3a", { p: [-0.12, 0.48, -0.06] }),
  ]);
}

function tomatoFruits() {
  return merge([
    part(P.sphere(0.075, 6, 5), "#ff4a2e", { p: [0.2, 0.3, 0.12] }),
    part(P.sphere(0.07, 6, 5), "#ff5a36", { p: [-0.16, 0.38, 0.17] }),
    part(P.sphere(0.065, 6, 5), "#ff4a2e", { p: [0.05, 0.22, -0.22] }),
  ]);
}

function treeTrunk() {
  return merge([
    part(P.cyl(0.13, 0.2, 1.5, 6), "#8a5a33", { p: [0, 0.75, 0] }),
    part(P.cyl(0.06, 0.09, 0.6, 5), "#8a5a33", { p: [0.25, 1.3, 0], r: [0, 0, -0.8] }),
  ]);
}

function treeCanopy(color: string, shade: string) {
  return merge([
    part(P.ico(0.95, 0), color, { p: [0, 2.05, 0] }),
    part(P.ico(0.6, 0), shade, { p: [0.55, 1.75, 0.25] }),
    part(P.ico(0.55, 0), color, { p: [-0.5, 1.8, -0.2] }),
    part(P.ico(0.5, 0), shade, { p: [0.1, 2.6, -0.1] }),
  ]);
}

function apple() {
  return merge([
    part(P.sphere(0.13, 7, 5), "#e8413c"),
    part(P.cyl(0.012, 0.012, 0.06, 4), "#7a4b26", { p: [0, 0.14, 0] }),
  ]);
}

/** A clump of flowers in one dominant colour (with a few accents). */
function flowers(main: string, accent: string) {
  const rnd = mulberry32(main.length * 31 + main.charCodeAt(1));
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd();
    const r = i === 0 ? 0 : 0.12 + rnd() * 0.14;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.32 + rnd() * 0.2;
    const petal = i % 3 === 2 ? accent : main;
    parts.push(part(P.cyl(0.015, 0.02, h, 4), "#4f9e38", { p: [x, h / 2, z] }));
    for (let k = 0; k < 5; k++) {
      const pa = (k / 5) * Math.PI * 2;
      parts.push(part(P.sphere(0.05, 5, 3), petal, { p: [x + Math.cos(pa) * 0.06, h + 0.02, z + Math.sin(pa) * 0.06], s: [1, 0.45, 1] }));
    }
    parts.push(part(P.sphere(0.035, 5, 3), "#ffd23f", { p: [x, h + 0.04, z] }));
  }
  parts.push(part(P.cone(0.06, 0.26, 4), "#5fae45", { p: [0.08, 0.13, 0.05], r: [0.3, 0, -0.5] }));
  parts.push(part(P.cone(0.06, 0.24, 4), "#5fae45", { p: [-0.09, 0.12, -0.04], r: [-0.3, 0, 0.5] }));
  return merge(parts);
}

/** Water ripple ring around a fishing spot. */
function ripple() {
  return merge([part(new TorusGeometry(0.42, 0.035, 4, 18), "#e9f8ff", { r: [Math.PI / 2, 0, 0] })]);
}

const builders = {
  flowersPink: () => flowers("#ff6b8a", "#ffffff"),
  flowersYellow: () => flowers("#ffd23f", "#ff9f1c"),
  flowersPurple: () => flowers("#b98cff", "#ff6b8a"),
  ripple,
  wheat,
  corn,
  grass,
  tomatoBush,
  tomatoFruits,
  treeTrunk,
  appleCanopy: () => treeCanopy("#4fae3a", "#3f9b2f"),
  apple,
};

export type CropModel = keyof typeof builders;

const cache = new Map<string, BufferGeometry>();
export function cropGeometry(id: CropModel) {
  let g = cache.get(id);
  if (!g) {
    g = builders[id]();
    cache.set(id, g);
  }
  return g;
}
