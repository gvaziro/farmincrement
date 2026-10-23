/**
 * Low-poly building kit: cached geometries/materials + a tiny <Part> wrapper.
 * Everything uses flat-shaded Lambert for the toy look. Materials react to the
 * seasons (snow on top) unless a subtree is wrapped in <Plain>.
 */
import { createContext, useContext, type ReactNode } from "react";
import { BufferGeometry, BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Float32BufferAttribute, IcosahedronGeometry, MeshLambertMaterial, SphereGeometry, TorusGeometry, type Material } from "three";
import type { ThreeElements } from "@react-three/fiber";
import { makeSeasonal, type SeasonKind } from "./seasonLook";

const mats = new Map<string, MeshLambertMaterial>();

/**
 * Cached flat colour material. By default it gets snow in winter; glowing or
 * see-through materials never do.
 */
export function mat(color: string, opts?: { emissive?: string; transparent?: boolean; opacity?: number; kind?: SeasonKind }): MeshLambertMaterial {
  const special = !!opts?.emissive || !!opts?.transparent || (opts?.opacity ?? 1) < 1;
  const kind: SeasonKind = special ? "plain" : (opts?.kind ?? "snow");
  const key = `${color}|${opts?.emissive ?? ""}|${opts?.opacity ?? 1}|${kind}`;
  let m = mats.get(key);
  if (!m) {
    m = new MeshLambertMaterial({ color, flatShading: true });
    if (opts?.emissive) m.emissive.set(opts.emissive);
    if (special && (opts?.transparent || (opts?.opacity ?? 1) < 1)) {
      m.transparent = true;
      m.opacity = opts?.opacity ?? 1;
      m.depthWrite = false;
    }
    makeSeasonal(m, kind);
    mats.set(key, m);
  }
  return m;
}

const SeasonKindContext = createContext<SeasonKind>("snow");

/** Parts inside stay as they are in every season (characters, animals). */
export function Plain({ children }: { children: ReactNode }) {
  return <SeasonKindContext.Provider value="plain">{children}</SeasonKindContext.Provider>;
}

const geos = new Map<string, BufferGeometry>();
function cached<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geos.get(key) as T | undefined;
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}

export const G = {
  box: (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, seg = 8) =>
    cached(`c${rt},${rb},${h},${seg}`, () => new CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 8) => cached(`k${r},${h},${seg}`, () => new ConeGeometry(r, h, seg)),
  sphere: (r: number, ws = 8, hs = 6) => cached(`s${r},${ws},${hs}`, () => new SphereGeometry(r, ws, hs)),
  ico: (r: number, detail = 0) => cached(`i${r},${detail}`, () => new IcosahedronGeometry(r, detail)),
  dodeca: (r: number) => cached(`d${r}`, () => new DodecahedronGeometry(r, 0)),
  torus: (r: number, tube: number, rs = 6, ts = 12) => cached(`t${r},${tube},${rs},${ts}`, () => new TorusGeometry(r, tube, rs, ts)),
  /** Gable roof: triangular prism, ridge along z (gables face ±z), base centred at y=0. */
  prism: (w: number, h: number, d: number) => cached(`p${w},${h},${d}`, () => prismGeometry(w, h, d)),
};

function prismGeometry(w: number, h: number, d: number) {
  const x = w / 2;
  const z = d / 2;
  // 6 vertices: front triangle (z+), back triangle (z−); flat-shaded faces.
  const A = [-x, 0, z], B = [x, 0, z], C = [0, h, z];
  const D = [-x, 0, -z], E = [x, 0, -z], F = [0, h, -z];
  const tris = [
    A, B, C, // front
    E, D, F, // back
    D, A, C, D, C, F, // left slope
    B, E, F, B, F, C, // right slope
    D, E, B, D, B, A, // bottom
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => pos.set(v, i * 3));
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

type MeshProps = ThreeElements["mesh"];

interface PartProps extends Omit<MeshProps, "geometry" | "material"> {
  g: BufferGeometry;
  c: string;
  m?: Material;
  shadow?: boolean;
}

/** One flat-shaded mesh. `c` = colour, `g` = cached geometry. */
export function Part({ g, c, m, shadow = true, ...rest }: PartProps) {
  const kind = useContext(SeasonKindContext);
  return <mesh geometry={g} material={m ?? mat(c, { kind })} castShadow={shadow} receiveShadow {...rest} />;
}
