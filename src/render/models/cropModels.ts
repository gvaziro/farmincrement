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

/** Low clump of strawberry leaves with a couple of white flowers. */
function strawberryBush() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(part(P.sphere(0.13, 5, 3), i % 2 ? "#3f9b2f" : "#4fae3a", { p: [Math.cos(a) * 0.17, 0.11, Math.sin(a) * 0.17], s: [1.2, 0.45, 1.2] }));
  }
  parts.push(part(P.sphere(0.15, 5, 3), "#5fbe45", { p: [0, 0.17, 0], s: [1.2, 0.5, 1.2] }));
  parts.push(part(P.sphere(0.035, 5, 3), "#ffffff", { p: [0.1, 0.25, 0.12] }));
  parts.push(part(P.sphere(0.035, 5, 3), "#ffffff", { p: [-0.14, 0.23, -0.05] }));
  return merge(parts);
}

/** Ripe red berries peeking out of the clump. */
function strawberryFruits() {
  const at: [number, number, number][] = [
    [0.25, 0.09, 0.1],
    [-0.21, 0.09, 0.17],
    [0.06, 0.09, -0.26],
    [-0.15, 0.1, -0.19],
  ];
  return merge(
    at.flatMap(([x, y, z]) => [
      part(P.sphere(0.078, 6, 5), "#e8323c", { p: [x, y, z], s: [1, 1.2, 1] }),
      part(P.cone(0.045, 0.035, 5), "#3f9b2f", { p: [x, y + 0.08, z] }),
    ]),
  );
}

/** A big ribbed pumpkin with a stem, lying among its leaves. */
function pumpkin() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(part(P.sphere(0.24, 8, 6), i % 2 ? "#f28c28" : "#e07a1c", { p: [Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12], s: [0.75, 0.85, 0.75] }));
  }
  parts.push(part(P.sphere(0.27, 8, 6), "#f59a35", { p: [0, 0.25, 0], s: [1, 0.82, 1] }));
  parts.push(part(P.cyl(0.035, 0.05, 0.16, 5), "#5a7a2a", { p: [0.02, 0.5, 0], r: [0.25, 0, 0.2] }));
  parts.push(part(P.cone(0.2, 0.05, 5), "#4fae3a", { p: [0.36, 0.03, 0.12] }));
  parts.push(part(P.cone(0.17, 0.05, 5), "#3f9b2f", { p: [-0.34, 0.03, -0.16] }));
  parts.push(part(P.cyl(0.018, 0.018, 0.4, 4), "#5fae45", { p: [0.22, 0.05, -0.28], r: [Math.PI / 2, 0, 0.7] }));
  return merge(parts);
}

// ── the island ──────────────────────────────────────────────────────────
function pineapplePlant() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push(part(P.cone(0.06, 0.55, 4), i % 2 ? "#4f9e3a" : "#3f8f2f", { p: [Math.cos(a) * 0.14, 0.24, Math.sin(a) * 0.14], r: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7] }));
  }
  parts.push(part(P.sphere(0.15, 8, 6), "#f2c230", { p: [0, 0.45, 0], s: [1, 1.3, 1] }));
  parts.push(part(P.sphere(0.152, 8, 6), "#c99a20", { p: [0, 0.45, 0], s: [0.55, 1.31, 1.02] }));
  parts.push(part(P.cone(0.07, 0.22, 5), "#5fbe45", { p: [0, 0.73, 0] }));
  return merge(parts);
}

function canePlant() {
  const rnd = mulberry32(31);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    const x = Math.cos(a) * 0.14;
    const z = Math.sin(a) * 0.14;
    const h = 1.0 + rnd() * 0.35;
    parts.push(part(P.cyl(0.035, 0.04, h, 5), i % 2 ? "#9fd06a" : "#8cc25a", { p: [x, h / 2, z] }));
    for (const y of [0.3, 0.6, 0.9]) if (y < h) parts.push(part(P.cyl(0.042, 0.042, 0.03, 5), "#6f9e3a", { p: [x, y, z] }));
    parts.push(part(P.cone(0.05, 0.5, 3), "#6cc24a", { p: [x * 1.6, h + 0.05, z * 1.6], r: [z * 2, 0, -x * 2] }));
  }
  return merge(parts);
}

function coffeeBush() {
  return merge([
    part(P.cyl(0.04, 0.06, 0.4, 5), "#6b4f2a", { p: [0, 0.2, 0] }),
    part(P.ico(0.36, 0), "#2f7f2a", { p: [0, 0.6, 0], s: [1, 0.85, 1] }),
    part(P.ico(0.24, 0), "#3f8f2f", { p: [0.2, 0.75, 0.1] }),
    part(P.ico(0.22, 0), "#2a6f25", { p: [-0.18, 0.72, -0.12] }),
  ]);
}

function coffeeBerries() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(part(P.sphere(0.045, 5, 4), i % 2 ? "#d7263d" : "#b0182c", { p: [Math.cos(a) * 0.3, 0.55 + (i % 3) * 0.1, Math.sin(a) * 0.3] }));
  }
  return merge(parts);
}

function vanillaVine() {
  return merge([
    part(P.cyl(0.03, 0.03, 0.9, 4), "#8a5a33", { p: [0, 0.45, 0] }),
    part(P.cone(0.12, 0.25, 4), "#4fae3a", { p: [0.1, 0.35, 0], r: [0, 0, -1.2] }),
    part(P.cone(0.12, 0.25, 4), "#5fbe45", { p: [-0.1, 0.55, 0.05], r: [0, 0, 1.2] }),
    part(P.cone(0.12, 0.25, 4), "#4fae3a", { p: [0.08, 0.75, -0.05], r: [0, 0, -1.2] }),
  ]);
}

function vanillaFlowers() {
  return merge([
    part(P.sphere(0.07, 6, 4), "#fff4c8", { p: [0.16, 0.5, 0.05] }),
    part(P.sphere(0.07, 6, 4), "#f4e6b0", { p: [-0.15, 0.7, 0.04] }),
    part(P.sphere(0.06, 6, 4), "#fff4c8", { p: [0.12, 0.88, -0.04] }),
    part(P.cyl(0.015, 0.015, 0.22, 4), "#3a2a1a", { p: [-0.05, 0.4, 0.12], r: [0.3, 0, 0] }),
  ]);
}

function bananaTrunk() {
  return merge([part(P.cyl(0.13, 0.17, 2.0, 7), "#9a8a4a", { p: [0, 1.0, 0] }), part(P.cyl(0.14, 0.14, 0.1, 7), "#7a6a3a", { p: [0, 0.6, 0] })]);
}

function bananaLeaves() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(part(P.box(0.32, 0.03, 1.3), i % 2 ? "#5fbe45" : "#4fae3a", { p: [Math.cos(a) * 0.55, 2.25, Math.sin(a) * 0.55], r: [0, -a + Math.PI / 2, 0.45] }));
  }
  parts.push(part(P.cone(0.12, 0.4, 5), "#4fae3a", { p: [0, 2.4, 0] }));
  return merge(parts);
}

function bananaBunch() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(part(P.cyl(0.035, 0.045, 0.22, 5), "#ffe14d", { p: [Math.cos(a) * 0.06, -0.05, Math.sin(a) * 0.06], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] }));
  }
  parts.push(part(P.cyl(0.02, 0.02, 0.16, 4), "#6b4f2a", { p: [0, 0.1, 0] }));
  return merge(parts);
}

function palmTrunk() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) parts.push(part(P.cyl(0.14 - i * 0.006, 0.16 - i * 0.006, 0.5, 7), i % 2 ? "#a8844a" : "#93733f", { p: [i * 0.05, 0.25 + i * 0.48, 0], r: [0, 0, -0.08] }));
  return merge(parts);
}

function palmLeaves() {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(part(P.box(0.3, 0.03, 1.6), i % 2 ? "#4fae3a" : "#3f9b2f", { p: [0.3 + Math.cos(a) * 0.75, 2.75, Math.sin(a) * 0.75], r: [0, -a + Math.PI / 2, 0.38] }));
  }
  parts.push(part(P.sphere(0.2, 6, 4), "#5a8a2a", { p: [0.3, 2.85, 0] }));
  return merge(parts);
}

function coconutFruit() {
  return merge([part(P.sphere(0.13, 7, 5), "#7a4b26")]);
}

function cocoaCanopy() {
  return merge([
    part(P.ico(0.85, 0), "#3f8f2f", { p: [0, 2.1, 0] }),
    part(P.ico(0.55, 0), "#2f7f2a", { p: [0.5, 1.8, 0.3] }),
    part(P.ico(0.5, 0), "#4f9e3a", { p: [-0.45, 1.85, -0.25] }),
  ]);
}

function cocoaPod() {
  return merge([part(P.sphere(0.1, 7, 5), "#e09030", { s: [0.85, 1.5, 0.85] }), part(P.cyl(0.015, 0.015, 0.08, 4), "#6b4f2a", { p: [0, 0.16, 0] })]);
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
  strawberryBush,
  strawberryFruits,
  pumpkin,
  wheat,
  corn,
  grass,
  tomatoBush,
  tomatoFruits,
  treeTrunk,
  appleCanopy: () => treeCanopy("#4fae3a", "#3f9b2f"),
  apple,
  pineapplePlant,
  canePlant,
  coffeeBush,
  coffeeBerries,
  vanillaVine,
  vanillaFlowers,
  bananaTrunk,
  bananaLeaves,
  bananaBunch,
  palmTrunk,
  palmLeaves,
  coconutFruit,
  cocoaCanopy,
  cocoaPod,
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
