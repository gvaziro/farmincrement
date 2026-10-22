"use client";

import { useMemo } from "react";
import { BackSide, ExtrudeGeometry, MeshBasicMaterial, Shape, ShapeGeometry, type BufferGeometry } from "three";
import { mat } from "./kit";

const cache = new Map<string, BufferGeometry>();

function roundedRectShape(w: number, d: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  const rr = Math.min(r, w / 2, d / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + d - rr);
  s.quadraticCurveTo(x + w, y + d, x + w - rr, y + d);
  s.lineTo(x + rr, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

/** Flat rounded rectangle lying on the ground (XZ plane). */
export function roundedRectGeometry(w: number, d: number, r: number) {
  const key = `rr${w.toFixed(2)},${d.toFixed(2)},${r}`;
  let g = cache.get(key);
  if (!g) {
    g = new ShapeGeometry(roundedRectShape(w, d, r), 6);
    g.rotateX(-Math.PI / 2);
    cache.set(key, g);
  }
  return g;
}

/**
 * Paved lot under a building: a rim plus a lighter inner area. Placed by
 * centre (x, z) and size in metres.
 */
export function Plaza({ x, z, w, d, color = "#e6d3a0", rim = "#cdb57c", y = 0.008 }: { x: number; z: number; w: number; d: number; color?: string; rim?: string; y?: number }) {
  const outer = roundedRectGeometry(w, d, 0.9);
  const inner = roundedRectGeometry(Math.max(0.1, w - 0.36), Math.max(0.1, d - 0.36), 0.75);
  return (
    <group position={[x, y, z]}>
      <mesh geometry={outer} material={mat(rim)} receiveShadow />
      <mesh geometry={inner} material={mat(color)} position={[0, 0.004, 0]} receiveShadow />
    </group>
  );
}

// ── arrow ───────────────────────────────────────────────────────────────
let arrowGeo: ExtrudeGeometry | null = null;

/** Chunky arrow pointing down (−y), centred, ~1 unit tall. */
export function arrowGeometry() {
  if (arrowGeo) return arrowGeo;
  const s = new Shape();
  s.moveTo(-0.2, 0.55);
  s.lineTo(0.2, 0.55);
  s.lineTo(0.2, 0.05);
  s.lineTo(0.46, 0.05);
  s.lineTo(0, -0.5);
  s.lineTo(-0.46, 0.05);
  s.lineTo(-0.2, 0.05);
  s.closePath();
  arrowGeo = new ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  arrowGeo.translate(0, 0, -0.08);
  arrowGeo.computeVertexNormals();
  return arrowGeo;
}

const outlineMat = new MeshBasicMaterial({ color: "#7a4300", side: BackSide });

/** Yellow cartoon arrow with a dark outline (inverted hull). */
export function Arrow3D({ color = "#ffcf33" }: { color?: string }) {
  const geo = useMemo(() => arrowGeometry(), []);
  return (
    <group>
      <mesh geometry={geo} material={mat(color, { emissive: "#6b4700" })} castShadow />
      <mesh geometry={geo} material={outlineMat} scale={[1.12, 1.08, 1.4]} />
    </group>
  );
}
