/**
 * Builds single-draw-call geometries with baked vertex colours — used for
 * everything instanced (items, crops, trees, decor).
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];

export interface PartOpts {
  p?: V3;
  r?: V3;
  s?: V3 | number;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const col = new Color();

/** Transform a primitive and paint it a single colour. */
export function part(geo: BufferGeometry, color: string, o: PartOpts = {}): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute("uv");
  const s = o.s === undefined ? [1, 1, 1] : typeof o.s === "number" ? [o.s, o.s, o.s] : o.s;
  e.set(...(o.r ?? [0, 0, 0]));
  q.setFromEuler(e);
  m4.compose(new Vector3(...(o.p ?? [0, 0, 0])), q, new Vector3(s[0], s[1], s[2]));
  g.applyMatrix4(m4);
  col.set(color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g;
}

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("mergeGeometries failed");
  g.computeBoundingSphere();
  return g;
}

// Primitive shortcuts (created on demand, they get cloned by `part`).
export const P = {
  box: (w: number, h: number, d: number) => new BoxGeometry(w, h, d),
  cyl: (rt: number, rb: number, h: number, seg = 8) => new CylinderGeometry(rt, rb, h, seg),
  cone: (r: number, h: number, seg = 7) => new ConeGeometry(r, h, seg),
  sphere: (r: number, ws = 8, hs = 6) => new SphereGeometry(r, ws, hs),
  ico: (r: number, detail = 0) => new IcosahedronGeometry(r, detail),
};
