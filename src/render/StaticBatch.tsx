"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Mesh, MeshLambertMaterial, type Group, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ThreeElements } from "@react-three/fiber";
import { makeSeasonal, seasonKindOf, type SeasonKind } from "./seasonLook";

const batchMaterials = new Map<SeasonKind, MeshLambertMaterial>();
/** One shared vertex-coloured material per seasonal kind. */
function batchMaterial(kind: SeasonKind) {
  let m = batchMaterials.get(kind);
  if (!m) {
    m = makeSeasonal(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), kind);
    batchMaterials.set(kind, m);
  }
  return m;
}
const inv = new Matrix4();
const rel = new Matrix4();
const tint = new Color();

/** Mark a subtree as animated so StaticBatch leaves it alone. */
export const DYNAMIC = { dynamic: true } as const;

function collect(obj: Object3D, out: Mesh[]) {
  for (const child of obj.children) {
    if (child.userData.dynamic) continue;
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      const m = mesh.material;
      if (!Array.isArray(m) && m instanceof MeshLambertMaterial && !m.map && !m.transparent && m.emissive.getHex() === 0) out.push(mesh);
    }
    collect(child, out);
  }
}

/**
 * Renders its children normally, then bakes every static flat-coloured mesh
 * into one vertex-coloured mesh per seasonal kind (usually one draw call) and
 * hides the originals. Subtrees with userData.dynamic stay live.
 */
export function StaticBatch({ children, shadow = true, ...rest }: { children: ReactNode; shadow?: boolean } & ThreeElements["group"]) {
  const ref = useRef<Group>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    inv.copy(root.matrixWorld).invert();
    const meshes: Mesh[] = [];
    collect(root, meshes);
    if (meshes.length < 2) return;

    const groups = new Map<SeasonKind, BufferGeometry[]>();
    for (const mesh of meshes) {
      const src = mesh.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      const own = g.getAttribute("color");
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "color") g.deleteAttribute(name);
      rel.multiplyMatrices(inv, mesh.matrixWorld);
      g.applyMatrix4(rel);
      const mat = mesh.material as MeshLambertMaterial;
      tint.copy(mat.color);
      const n = g.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        // Vertex-coloured sources (item props) keep their colours.
        const useOwn = own && mat.vertexColors;
        colors[i * 3] = (useOwn ? own.getX(i) : 1) * tint.r;
        colors[i * 3 + 1] = (useOwn ? own.getY(i) : 1) * tint.g;
        colors[i * 3 + 2] = (useOwn ? own.getZ(i) : 1) * tint.b;
      }
      g.setAttribute("color", new Float32BufferAttribute(colors, 3));
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      const kind = seasonKindOf(mat);
      let list = groups.get(kind);
      if (!list) groups.set(kind, (list = []));
      list.push(g);
    }
    const batches: Mesh[] = [];
    for (const [kind, parts] of groups) {
      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const batch = new Mesh(merged, batchMaterial(kind));
      batch.castShadow = shadow;
      batch.receiveShadow = true;
      batch.userData.batch = true;
      root.add(batch);
      batches.push(batch);
    }
    for (const m of meshes) m.visible = false;
    return () => {
      for (const b of batches) {
        root.remove(b);
        b.geometry.dispose();
      }
      for (const m of meshes) m.visible = true;
    };
  }, [shadow]);

  return (
    <group ref={ref} {...rest}>
      {children}
    </group>
  );
}
