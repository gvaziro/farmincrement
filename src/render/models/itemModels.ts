/**
 * Instanced item geometries. Each item: centred in x/z, resting on y=0,
 * height ≈ ITEMS[id].height so stacks line up.
 */
import { TorusGeometry, type BufferGeometry } from "three";
import type { ItemId } from "@/game/data/items";
import { merge, P, part } from "../geom";

const HALF_PI = Math.PI / 2;

function sack(body: string, label: string, tie: string, h: number) {
  return merge([
    part(P.sphere(0.2, 9, 7), body, { p: [0, h / 2, 0], s: [1.12, h / 0.4, 0.85] }),
    part(P.box(0.2, 0.02, 0.16), label, { p: [0, h - 0.01, 0] }),
    part(P.cone(0.07, 0.1, 6), tie, { p: [0.25, h / 2 + 0.02, 0], r: [0, 0, -HALF_PI] }),
  ]);
}

/** A ribbed pumpkin (raw, or carved into a lantern with a glowing face). */
function pumpkinBody(main: string, rib: string) {
  return [
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return part(P.sphere(0.15, 8, 6), i % 2 ? main : rib, { p: [Math.cos(a) * 0.07, 0.13, Math.sin(a) * 0.07], s: [0.75, 0.85, 0.75] });
    }),
    part(P.sphere(0.16, 8, 6), main, { p: [0, 0.13, 0], s: [1, 0.82, 1] }),
    part(P.cyl(0.025, 0.035, 0.09, 5), "#5a7a2a", { p: [0, 0.27, 0], r: [0.2, 0, 0.1] }),
  ];
}

function pair(make: (x: number) => BufferGeometry[]) {
  return merge([...make(-0.1), ...make(0.1)]);
}

const builders: Record<ItemId | "coin", () => BufferGeometry> = {
  wheat: () =>
    merge([
      part(P.cyl(0.1, 0.1, 0.4, 7), "#f2c94c", { p: [-0.02, 0.11, 0], r: [0, 0, HALF_PI] }),
      part(P.cyl(0.108, 0.108, 0.07, 7), "#b5732e", { p: [-0.02, 0.11, 0], r: [0, 0, HALF_PI] }),
      part(P.cone(0.125, 0.16, 7), "#e9b949", { p: [0.25, 0.11, 0], r: [0, 0, -HALF_PI] }),
      part(P.cyl(0.095, 0.095, 0.02, 7), "#c9a04a", { p: [-0.22, 0.11, 0], r: [0, 0, HALF_PI] }),
    ]),
  corn: () =>
    merge([
      part(P.cyl(0.085, 0.085, 0.3, 8), "#ffd23f", { p: [0, 0.1, 0], r: [0, 0, HALF_PI] }),
      part(P.sphere(0.085, 8, 5), "#ffd23f", { p: [0.15, 0.1, 0], s: [0.8, 1, 1] }),
      part(P.cone(0.1, 0.26, 6), "#7cc24f", { p: [-0.2, 0.1, 0.03], r: [0, 0.3, HALF_PI] }),
      part(P.cone(0.08, 0.24, 6), "#5fae45", { p: [-0.19, 0.12, -0.04], r: [0, -0.4, HALF_PI] }),
    ]),
  grass: () =>
    merge([
      part(P.box(0.46, 0.24, 0.34), "#c3dc62", { p: [0, 0.12, 0] }),
      part(P.box(0.05, 0.25, 0.35), "#8a6a3a", { p: [-0.12, 0.12, 0] }),
      part(P.box(0.05, 0.25, 0.35), "#8a6a3a", { p: [0.12, 0.12, 0] }),
      part(P.box(0.4, 0.02, 0.28), "#d6ea7a", { p: [0, 0.245, 0] }),
    ]),
  apple: () =>
    merge([
      part(P.sphere(0.135, 8, 6), "#e8413c", { p: [0, 0.125, 0], s: [1, 0.9, 1] }),
      part(P.cyl(0.012, 0.012, 0.07, 4), "#7a4b26", { p: [0, 0.27, 0] }),
      part(P.sphere(0.04, 5, 3), "#4fae3a", { p: [0.04, 0.27, 0], s: [1.6, 0.4, 0.8] }),
    ]),
  tomato: () =>
    merge([
      part(P.sphere(0.135, 8, 6), "#ff5a36", { p: [0, 0.11, 0], s: [1, 0.78, 1] }),
      part(P.cone(0.09, 0.05, 5), "#3f9b2f", { p: [0, 0.225, 0], r: [Math.PI, 0, 0] }),
      part(P.cyl(0.012, 0.012, 0.05, 4), "#3f9b2f", { p: [0, 0.25, 0] }),
    ]),
  flour: () => sack("#f5efe3", "#6aa8e8", "#d9c8a5", 0.28),
  feed: () => sack("#c08a4a", "#6cc24a", "#8a5a2a", 0.28),
  egg: () =>
    merge([
      part(P.box(0.4, 0.06, 0.3), "#d2ad72", { p: [0, 0.03, 0] }),
      ...[
        [-0.1, -0.07],
        [0.1, -0.07],
        [-0.1, 0.07],
        [0.1, 0.07],
      ].map(([x, z]) => part(P.sphere(0.068, 7, 5), "#fff4dc", { p: [x, 0.125, z], s: [1, 1.3, 1] })),
    ]),
  milk: () =>
    pair((x) => [
      part(P.cyl(0.085, 0.09, 0.22, 8), "#ffffff", { p: [x, 0.11, 0] }),
      part(P.cyl(0.05, 0.085, 0.06, 8), "#ffffff", { p: [x, 0.25, 0] }),
      part(P.cyl(0.055, 0.055, 0.04, 8), "#3fa7ff", { p: [x, 0.3, 0] }),
      part(P.cyl(0.092, 0.092, 0.06, 8), "#9fd2ff", { p: [x, 0.12, 0] }),
    ]),
  bread: () =>
    merge([
      part(P.sphere(0.2, 9, 6), "#d9913f", { p: [0, 0.1, 0], s: [1.15, 0.6, 0.78] }),
      part(P.box(0.04, 0.03, 0.2), "#b06a2a", { p: [-0.1, 0.2, 0], r: [0, 0.5, 0] }),
      part(P.box(0.04, 0.03, 0.2), "#b06a2a", { p: [0, 0.215, 0], r: [0, 0.5, 0] }),
      part(P.box(0.04, 0.03, 0.2), "#b06a2a", { p: [0.1, 0.2, 0], r: [0, 0.5, 0] }),
    ]),
  cheese: () =>
    merge([
      part(P.cyl(0.2, 0.2, 0.17, 9), "#ffc93c", { p: [0, 0.085, 0] }),
      part(P.cyl(0.205, 0.205, 0.05, 9), "#f4a636", { p: [0, 0.085, 0] }),
      part(P.sphere(0.03, 5, 3), "#e0a020", { p: [0.08, 0.175, 0.05] }),
      part(P.sphere(0.025, 5, 3), "#e0a020", { p: [-0.07, 0.175, -0.06] }),
    ]),
  juice: () =>
    pair((x) => [
      part(P.box(0.16, 0.26, 0.16), "#ff9f1c", { p: [x, 0.13, 0] }),
      part(P.box(0.165, 0.08, 0.165), "#6cc24a", { p: [x, 0.14, 0] }),
      part(P.cone(0.12, 0.08, 4), "#ffb347", { p: [x, 0.3, 0], r: [0, Math.PI / 4, 0] }),
      part(P.cyl(0.01, 0.01, 0.12, 4), "#ffffff", { p: [x + 0.03, 0.34, 0], r: [0, 0, 0.25] }),
    ]),
  sauce: () =>
    pair((x) => [
      part(P.cyl(0.09, 0.09, 0.22, 8), "#d7263d", { p: [x, 0.11, 0] }),
      part(P.cyl(0.093, 0.093, 0.08, 8), "#fff4dc", { p: [x, 0.11, 0] }),
      part(P.cyl(0.08, 0.08, 0.05, 8), "#2f7d32", { p: [x, 0.245, 0] }),
    ]),
  cake: () =>
    merge([
      part(P.cyl(0.2, 0.2, 0.12, 10), "#f7d6a8", { p: [0, 0.06, 0] }),
      part(P.cyl(0.205, 0.205, 0.04, 10), "#ffffff", { p: [0, 0.14, 0] }),
      part(P.cyl(0.15, 0.15, 0.08, 10), "#ff8fb1", { p: [0, 0.2, 0] }),
      part(P.sphere(0.045, 6, 4), "#d7263d", { p: [0, 0.27, 0] }),
    ]),
  fish: () =>
    merge([
      part(P.sphere(0.12, 8, 6), "#6fa8c8", { p: [0, 0.1, 0], s: [1.9, 0.75, 0.7] }),
      part(P.sphere(0.1, 8, 5), "#d9eef7", { p: [0.02, 0.07, 0], s: [1.6, 0.4, 0.62] }),
      part(P.cone(0.1, 0.16, 4), "#4f8fb0", { p: [-0.27, 0.1, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.35] }),
      part(P.cone(0.05, 0.12, 4), "#4f8fb0", { p: [0, 0.2, 0], s: [1.4, 1, 0.3] }),
      part(P.sphere(0.022, 5, 4), "#1d2b33", { p: [0.17, 0.12, 0.06] }),
      part(P.sphere(0.022, 5, 4), "#1d2b33", { p: [0.17, 0.12, -0.06] }),
    ]),
  smokedfish: () =>
    merge([
      part(P.sphere(0.12, 8, 6), "#c9772f", { p: [0, 0.1, 0.02], s: [1.95, 0.72, 0.68] }),
      part(P.sphere(0.1, 8, 5), "#e8a65a", { p: [0.02, 0.08, 0.02], s: [1.6, 0.45, 0.6] }),
      part(P.cone(0.1, 0.16, 4), "#9a5522", { p: [-0.27, 0.1, 0.02], r: [0, 0, Math.PI / 2], s: [1, 1, 0.35] }),
      part(P.box(0.03, 0.2, 0.2), "#7a4b26", { p: [0.04, 0.1, 0.02] }),
      part(P.cyl(0.012, 0.012, 0.36, 4), "#d9c49a", { p: [0.04, 0.2, 0.02], r: [Math.PI / 2, 0, 0] }),
    ]),
  canned: () =>
    pair((x) => [
      part(P.cyl(0.095, 0.095, 0.15, 10), "#cfd8dc", { p: [x, 0.075, 0] }),
      part(P.cyl(0.098, 0.098, 0.09, 10), "#3f8fd9", { p: [x, 0.075, 0] }),
      part(P.sphere(0.035, 5, 3), "#ffcc33", { p: [x + 0.06, 0.08, 0.06], s: [1.3, 0.7, 0.5] }),
      part(P.cyl(0.07, 0.07, 0.01, 10), "#9fb0b8", { p: [x, 0.155, 0] }),
    ]),
  flower: () =>
    merge([
      part(P.cone(0.12, 0.3, 6), "#ffe0ec", { p: [-0.08, 0.12, 0], r: [0, 0, Math.PI / 2] }),
      part(P.cyl(0.01, 0.01, 0.2, 4), "#4f9e38", { p: [0.06, 0.12, 0], r: [0, 0, Math.PI / 2] }),
      ...[
        [0.16, 0.16, 0.0, "#ff6b8a"],
        [0.14, 0.1, 0.07, "#ffd23f"],
        [0.15, 0.1, -0.07, "#b98cff"],
        [0.12, 0.2, 0.05, "#ffffff"],
        [0.12, 0.2, -0.05, "#ff9f1c"],
      ].map(([x, y, z, c]) => part(P.sphere(0.055, 6, 4), c as string, { p: [x as number, y as number, z as number] })),
    ]),
  honeycomb: () =>
    merge([
      part(P.cyl(0.21, 0.21, 0.14, 6), "#f5b62a", { p: [0, 0.07, 0] }),
      part(P.cyl(0.19, 0.19, 0.02, 6), "#ffd166", { p: [0, 0.145, 0] }),
      ...[
        [0, 0],
        [0.09, 0.05],
        [-0.09, 0.05],
        [0.09, -0.05],
        [-0.09, -0.05],
        [0, 0.1],
        [0, -0.1],
      ].map(([x, z]) => part(P.cyl(0.035, 0.035, 0.02, 6), "#d98b1a", { p: [x, 0.155, z] })),
    ]),
  honey: () =>
    pair((x) => [
      part(P.cyl(0.085, 0.09, 0.22, 10), "#f0a020", { p: [x, 0.11, 0] }),
      part(P.cyl(0.088, 0.088, 0.07, 10), "#fff4dc", { p: [x, 0.1, 0] }),
      part(P.cyl(0.07, 0.085, 0.04, 10), "#ffd166", { p: [x, 0.24, 0] }),
      part(P.cyl(0.1, 0.1, 0.03, 10), "#d7263d", { p: [x, 0.27, 0] }),
      part(P.cyl(0.075, 0.075, 0.04, 10), "#ffffff", { p: [x, 0.29, 0] }),
    ]),
  wool: () =>
    merge([
      part(P.ico(0.14, 1), "#fbf8f0", { p: [0, 0.13, 0], s: [1.3, 0.95, 1.1] }),
      part(P.ico(0.1, 1), "#ffffff", { p: [0.12, 0.17, 0.05] }),
      part(P.ico(0.1, 1), "#f1ecdf", { p: [-0.12, 0.15, -0.04] }),
      part(P.ico(0.09, 1), "#ffffff", { p: [0.02, 0.22, -0.06] }),
    ]),
  yarn: () =>
    merge([
      part(P.sphere(0.15, 10, 8), "#e86fa6", { p: [0, 0.15, 0] }),
      part(new TorusGeometry(0.15, 0.02, 4, 18), "#ff9cc8", { p: [0, 0.15, 0], r: [0.3, 0, 0.2] }),
      part(new TorusGeometry(0.15, 0.02, 4, 18), "#c94f8a", { p: [0, 0.15, 0], r: [1.4, 0.4, 0] }),
      part(new TorusGeometry(0.15, 0.02, 4, 18), "#ff9cc8", { p: [0, 0.15, 0], r: [0.9, 1.2, 0] }),
      part(P.cyl(0.014, 0.014, 0.24, 4), "#e86fa6", { p: [0.18, 0.04, 0.05], r: [0, 0, 1.25] }),
    ]),
  sweater: () =>
    merge([
      part(P.box(0.42, 0.12, 0.34), "#d9485f", { p: [0, 0.06, 0] }),
      part(P.box(0.425, 0.03, 0.345), "#ffffff", { p: [0, 0.055, 0] }),
      part(P.box(0.14, 0.04, 0.24), "#c03a50", { p: [-0.12, 0.14, 0.01] }),
      part(P.box(0.14, 0.04, 0.24), "#c03a50", { p: [0.12, 0.14, 0.01] }),
      part(P.box(0.06, 0.045, 0.06), "#ffffff", { p: [0, 0.135, -0.02], r: [0, Math.PI / 4, 0] }),
      part(P.box(0.22, 0.05, 0.06), "#b8324a", { p: [0, 0.135, -0.15] }),
    ]),
  strawberry: () =>
    merge([
      part(P.box(0.34, 0.12, 0.26), "#7cc24f", { p: [0, 0.06, 0] }),
      part(P.box(0.3, 0.02, 0.22), "#5aa83f", { p: [0, 0.125, 0] }),
      ...[
        [-0.09, -0.05],
        [0.06, -0.06],
        [-0.05, 0.06],
        [0.1, 0.05],
        [0.0, 0.0],
      ].map(([x, z]) => part(P.sphere(0.06, 6, 5), "#e8323c", { p: [x, 0.16, z], s: [1, 1.15, 1] })),
      part(P.cone(0.04, 0.035, 5), "#3f9b2f", { p: [0, 0.23, 0] }),
      part(P.cone(0.04, 0.035, 5), "#3f9b2f", { p: [0.1, 0.23, 0.05] }),
    ]),
  jam: () =>
    merge([
      part(P.cyl(0.11, 0.11, 0.2, 10), "#a8124a", { p: [0, 0.1, 0] }),
      part(P.cyl(0.114, 0.114, 0.08, 10), "#fff4dc", { p: [0, 0.1, 0] }),
      part(P.sphere(0.03, 5, 3), "#e8323c", { p: [0.08, 0.1, 0.08], s: [1, 1.2, 0.5] }),
      part(P.cyl(0.12, 0.12, 0.04, 10), "#ffffff", { p: [0, 0.22, 0] }),
      part(P.cyl(0.14, 0.11, 0.05, 8), "#e8413c", { p: [0, 0.255, 0] }),
      part(P.cyl(0.123, 0.123, 0.015, 10), "#7a4b26", { p: [0, 0.235, 0] }),
    ]),
  icecream: () =>
    merge([
      part(P.cyl(0.13, 0.09, 0.15, 10), "#ffffff", { p: [0, 0.075, 0] }),
      part(P.cyl(0.125, 0.105, 0.05, 10), "#ff8fb1", { p: [0, 0.1, 0] }),
      part(P.sphere(0.11, 8, 6), "#ffc0d9", { p: [-0.05, 0.19, 0] }),
      part(P.sphere(0.1, 8, 6), "#fff4dc", { p: [0.06, 0.2, 0.02] }),
      part(P.sphere(0.04, 6, 4), "#e8323c", { p: [0, 0.3, 0.01] }),
      part(P.box(0.03, 0.12, 0.012), "#e0a96d", { p: [-0.08, 0.28, -0.03], r: [0, 0, 0.35] }),
    ]),
  pumpkin: () => merge(pumpkinBody("#f59a35", "#e07a1c")),
  pie: () =>
    merge([
      part(P.cyl(0.21, 0.17, 0.08, 12), "#c98b52", { p: [0, 0.04, 0] }),
      part(P.cyl(0.19, 0.19, 0.03, 12), "#f28c28", { p: [0, 0.085, 0] }),
      part(new TorusGeometry(0.19, 0.03, 4, 16), "#e0a96d", { p: [0, 0.095, 0], r: [Math.PI / 2, 0, 0] }),
      part(P.box(0.3, 0.015, 0.03), "#e0a96d", { p: [0, 0.1, 0.05] }),
      part(P.box(0.3, 0.015, 0.03), "#e0a96d", { p: [0, 0.1, -0.05] }),
      part(P.sphere(0.05, 6, 4), "#fff4dc", { p: [0, 0.115, 0], s: [1, 0.6, 1] }),
    ]),
  lantern: () =>
    merge([
      ...pumpkinBody("#ff7a1a", "#e8650f"),
      part(P.cone(0.04, 0.06, 3), "#ffe14d", { p: [-0.065, 0.17, 0.135], r: [Math.PI / 2, 0, 0] }),
      part(P.cone(0.04, 0.06, 3), "#ffe14d", { p: [0.065, 0.17, 0.135], r: [Math.PI / 2, 0, 0] }),
      part(P.box(0.14, 0.035, 0.03), "#ffe14d", { p: [0, 0.095, 0.14] }),
      part(P.box(0.03, 0.02, 0.031), "#ff7a1a", { p: [-0.03, 0.108, 0.141] }),
      part(P.box(0.03, 0.02, 0.031), "#ff7a1a", { p: [0.03, 0.108, 0.141] }),
    ]),
  coin: () =>
    merge([
      part(P.cyl(0.13, 0.13, 0.035, 10), "#ffcc33", { r: [HALF_PI, 0, 0] }),
      part(P.cyl(0.085, 0.085, 0.04, 10), "#ffe27a", { r: [HALF_PI, 0, 0] }),
    ]),
};

const cache = new Map<string, BufferGeometry>();
/** Models are authored small; this matches ITEMS[].height (authored × 1.15). */
const ITEM_SCALE = 1.15;

export function itemGeometry(id: ItemId | "coin"): BufferGeometry {
  let g = cache.get(id);
  if (!g) {
    g = builders[id]();
    if (id !== "coin") g.scale(ITEM_SCALE, ITEM_SCALE, ITEM_SCALE);
    g.computeBoundingSphere();
    cache.set(id, g);
  }
  return g;
}
