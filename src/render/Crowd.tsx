"use client";

/**
 * Everybody but the player in a handful of instanced meshes: workers and the
 * city's customers. A character used to be ~8 meshes (16 draw calls with
 * shadows); here every body part of every character is one instance, so the
 * whole crowd costs a fixed few dozen draw calls however big it grows.
 *
 * The look and the animation follow `Character` (Characters.tsx) one to one.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CircleGeometry, Color, Euler, InstancedMesh, Matrix4, MeshBasicMaterial, MeshLambertMaterial, Quaternion, TorusGeometry, Vector3, type BufferGeometry } from "three";
import { easeOutBack } from "@/game/core/math";
import type { Actor, Worker } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import type { Look } from "./Characters";
import { merge, P, part } from "./geom";
import { seasonVisual } from "./seasonLook";

export interface CrowdMember {
  actor: Actor;
  look: Look;
  /** 0 hides the character. */
  scale: number;
  /** Arms busy (an operator at work, a guest eating). */
  working: boolean;
  /** The wooden frame on the back that stacks ride on. */
  frame: boolean;
  /** A shopping bag in the right hand. */
  bag: boolean;
}

const MAX = 220;
const WHITE = "#ffffff";

// ── part geometries, in the space of the group they hang from ───────────
const geo = {
  pantsLeg: () => merge([part(P.box(0.15, 0.3, 0.16), WHITE, { p: [0, -0.15, 0] })]),
  shoe: () => merge([part(P.box(0.17, 0.08, 0.22), "#5a3a22", { p: [0, -0.32, 0.03] })]),
  torso: () => merge([part(P.cyl(0.21, 0.24, 0.44, 8), WHITE, { p: [0, 0.58, 0] })]),
  apron: () => merge([part(P.box(0.3, 0.26, 0.06), WHITE, { p: [0, 0.5, 0.2] }), part(P.cyl(0.245, 0.245, 0.12, 8), WHITE, { p: [0, 0.4, 0] })]),
  frame: () =>
    merge([
      part(P.box(0.5, 0.05, 0.36), "#a8642a", { p: [0, 0.63, -0.38] }),
      part(P.box(0.05, 0.5, 0.05), "#8a5a2a", { p: [-0.17, 0.62, -0.25], r: [0.25, 0, 0] }),
      part(P.box(0.05, 0.5, 0.05), "#8a5a2a", { p: [0.17, 0.62, -0.25], r: [0.25, 0, 0] }),
    ]),
  sleeve: () => merge([part(P.box(0.11, 0.32, 0.11), WHITE, { p: [0, -0.15, 0] })]),
  hand: () => merge([part(P.sphere(0.07, 6, 5), WHITE, { p: [0, -0.33, 0] })]),
  head: () => merge([part(P.sphere(0.22, 10, 8), WHITE, { p: [0, 0.04, 0] })]),
  face: () =>
    merge([
      part(P.sphere(0.03, 5, 4), "#2b2b2b", { p: [-0.075, 0.07, 0.195] }),
      part(P.sphere(0.03, 5, 4), "#2b2b2b", { p: [0.075, 0.07, 0.195] }),
      part(P.sphere(0.035, 5, 4), "#ff9e8a", { p: [-0.12, 0.0, 0.17] }),
      part(P.sphere(0.035, 5, 4), "#ff9e8a", { p: [0.12, 0.0, 0.17] }),
      part(P.sphere(0.035, 5, 4), "#f0a77a", { p: [0, 0.02, 0.22] }),
    ]),
  cap: () => merge([part(P.sphere(0.225, 10, 6), WHITE, { p: [0, 0.15, 0], s: [1, 0.62, 1] }), part(P.box(0.3, 0.03, 0.2), WHITE, { p: [0, 0.12, 0.2] })]),
  hard: () => merge([part(P.sphere(0.23, 10, 6), WHITE, { p: [0, 0.17, 0], s: [1, 0.7, 1] }), part(P.cyl(0.29, 0.29, 0.03, 12), WHITE, { p: [0, 0.14, 0] })]),
  hair: () => merge([part(P.sphere(0.235, 10, 6), WHITE, { p: [0, 0.12, -0.03], s: [1, 0.7, 1.02] })]),
  bow: () =>
    merge([
      part(P.cone(0.08, 0.14, 4), WHITE, { p: [-0.08, 0.27, -0.05], r: [0, 0, Math.PI / 2] }),
      part(P.cone(0.08, 0.14, 4), WHITE, { p: [0.08, 0.27, -0.05], r: [0, 0, -Math.PI / 2] }),
      part(P.sphere(0.04, 5, 4), WHITE, { p: [0, 0.27, -0.05] }),
    ]),
  chef: () =>
    merge([
      part(P.cyl(0.22, 0.22, 0.14, 12), "#ffffff", { p: [0, 0.21, 0] }),
      part(P.sphere(0.25, 10, 8), "#ffffff", { p: [0, 0.4, 0], s: [1, 0.75, 1] }),
      part(P.sphere(0.13, 8, 6), "#f4f4f4", { p: [-0.16, 0.39, 0.05] }),
      part(P.sphere(0.13, 8, 6), "#f4f4f4", { p: [0.16, 0.39, -0.05] }),
    ]),
  beanie: () => merge([part(P.sphere(0.235, 10, 6), WHITE, { p: [0, 0.15, 0], s: [1, 0.82, 1] })]),
  beanieRim: () => merge([part(P.cyl(0.24, 0.24, 0.08, 12), "#ffffff", { p: [0, 0.1, 0] }), part(P.sphere(0.08, 8, 6), "#ffffff", { p: [0, 0.36, 0] })]),
  scarf: () =>
    merge([
      part(new TorusGeometry(0.17, 0.065, 5, 12), WHITE, { p: [0, 0.83, 0], r: [Math.PI / 2, 0, 0] }),
      part(P.box(0.1, 0.28, 0.05), WHITE, { p: [0.09, 0.67, 0.19], r: [0.15, 0, -0.12] }),
      part(P.box(0.105, 0.04, 0.055), "#ffffff", { p: [0.075, 0.56, 0.205], r: [0.15, 0, -0.12] }),
    ]),
  bag: () =>
    merge([
      part(P.box(0.24, 0.26, 0.14), "#d9a86a", { p: [0, -0.5, 0.07] }),
      part(P.box(0.2, 0.06, 0.15), "#7cc24f", { p: [0, -0.35, 0.07] }),
      part(P.sphere(0.05, 5, 4), "#e8413c", { p: [0.05, -0.32, 0.07] }),
    ]),
};
type PartId = keyof typeof geo;

const mat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const blobMat = new MeshBasicMaterial({ color: "#1d3b12", transparent: true, opacity: 0.22, depthWrite: false });
const blobGeo = new CircleGeometry(0.42, 16).rotateX(-Math.PI / 2);

let geos: Record<PartId, BufferGeometry> | null = null;
const geometries = () => (geos ??= Object.fromEntries((Object.keys(geo) as PartId[]).map((k) => [k, geo[k]()])) as Record<PartId, BufferGeometry>);

// ── scratch ─────────────────────────────────────────────────────────────
const root = new Matrix4();
const body = new Matrix4();
const limb = new Matrix4();
const local = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
const s = new Vector3();
const color = new Color();
const UP = new Vector3(0, 1, 0);

/** A group's local matrix: rotation (Euler XYZ, like Object3D) then position. */
function groupMatrix(out: Matrix4, x: number, y: number, z: number, rx: number, rz = 0) {
  e.set(rx, 0, rz);
  out.makeRotationFromEuler(e);
  out.setPosition(x, y, z);
  return out;
}

class Batch {
  n = 0;
  constructor(readonly mesh: InstancedMesh) {}
  add(m: Matrix4, c?: string) {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    this.mesh.setMatrixAt(this.n, m);
    this.mesh.setColorAt(this.n, color.set(c ?? WHITE));
    this.n++;
  }
  flush() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.n = 0;
  }
}

/** Per part: how many instances one character may need. */
const PER: Record<PartId, number> = { pantsLeg: 2, shoe: 2, torso: 1, apron: 1, frame: 1, sleeve: 2, hand: 2, head: 1, face: 1, cap: 1, hard: 1, hair: 1, bow: 1, chef: 1, beanie: 1, beanieRim: 1, scarf: 1, bag: 1 };

export function Crowd({ runtime, collect }: { runtime: Runtime; collect: (out: CrowdMember[]) => void }) {
  const refs = useRef<Partial<Record<PartId, InstancedMesh>>>({});
  const blobs = useRef<InstancedMesh>(null);
  const list = useMemo<CrowdMember[]>(() => [], []);
  const g = geometries();
  void runtime;

  useFrame((state) => {
    const r = refs.current;
    const batches = new Map<PartId, Batch>();
    for (const k of Object.keys(geo) as PartId[]) {
      const m = r[k];
      if (m) batches.set(k, new Batch(m));
    }
    const bl = blobs.current;
    if (!bl || batches.size === 0) return;
    const blob = new Batch(bl);
    const t = state.clock.elapsedTime;
    const scarves = seasonVisual.winter + seasonVisual.autumn >= 0.5;
    list.length = 0;
    collect(list);
    for (const c of list) {
      const a = c.actor;
      if (c.scale <= 0.005) continue;
      const sc = Math.max(0.01, c.scale);
      q.setFromAxisAngle(UP, a.facing);
      root.compose(v.set(a.x, 0, a.z), q, s.set(sc, sc, sc));
      blob.add(local.copy(root).multiply(limb.makeTranslation(0, 0.02, -0.05)));

      const speed = Math.hypot(a.vx, a.vz);
      const moving = a.moving && speed > 0.3;
      const ph = a.walk * 2.2;
      const swing = moving ? Math.min(1, speed / 3) : 0;
      const carrying = a.stack.length > 0;
      const bob = moving ? Math.abs(Math.sin(ph)) * 0.07 : Math.sin(t * 2.4) * 0.012;
      body.copy(root).multiply(groupMatrix(local, 0, bob, 0, moving ? 0.1 * swing : 0));
      const L = c.look;

      // Legs.
      for (const side of [-1, 1]) {
        limb.copy(body).multiply(groupMatrix(local, side * 0.1, 0.36, 0, side * -Math.sin(ph) * 0.75 * swing));
        batches.get("pantsLeg")!.add(limb, L.pants);
        batches.get("shoe")!.add(limb);
      }
      // Torso.
      batches.get("torso")!.add(body, L.shirt);
      batches.get("apron")!.add(body, L.pants);
      if (c.frame) batches.get("frame")!.add(body);
      if (L.scarf && scarves) batches.get("scarf")!.add(body, L.scarf);
      // Arms.
      let al: number;
      let ar: number;
      if (c.working) {
        al = -1.2 + Math.sin(t * 9) * 0.35;
        ar = -1.2 - Math.sin(t * 9) * 0.35;
      } else if (carrying) {
        al = -0.35 - Math.sin(ph) * 0.25 * swing;
        ar = -0.35 + Math.sin(ph) * 0.25 * swing;
      } else {
        al = -Math.sin(ph) * 0.7 * swing + Math.sin(t * 2) * 0.04;
        ar = Math.sin(ph) * 0.7 * swing - Math.sin(t * 2) * 0.04;
      }
      limb.copy(body).multiply(groupMatrix(local, -0.27, 0.76, 0, al, 0.12));
      batches.get("sleeve")!.add(limb, L.shirt);
      batches.get("hand")!.add(limb, L.skin);
      limb.copy(body).multiply(groupMatrix(local, 0.27, 0.76, 0, ar, -0.12));
      batches.get("sleeve")!.add(limb, L.shirt);
      batches.get("hand")!.add(limb, L.skin);
      if (c.bag) batches.get("bag")!.add(limb);
      // Head and hat.
      limb.copy(body).multiply(groupMatrix(local, 0, 0.98, 0, 0, moving ? Math.sin(ph) * 0.05 : Math.sin(t * 1.3) * 0.04));
      batches.get("head")!.add(limb, L.skin);
      batches.get("face")!.add(limb);
      switch (L.hat) {
        case "cap":
          batches.get("cap")!.add(limb, L.hatColor);
          break;
        case "hard":
          batches.get("hard")!.add(limb, L.hatColor);
          break;
        case "chef":
          batches.get("chef")!.add(limb);
          break;
        case "beanie":
          batches.get("beanie")!.add(limb, L.hatColor);
          batches.get("beanieRim")!.add(limb);
          break;
        case "bow":
          batches.get("hair")!.add(limb, L.hair ?? "#6b3e1f");
          batches.get("bow")!.add(limb, L.hatColor);
          break;
        default:
          batches.get("hair")!.add(limb, L.hair ?? "#6b3e1f");
      }
    }
    for (const b of batches.values()) b.flush();
    blob.flush();
  });

  return (
    <group>
      <instancedMesh ref={blobs} args={[blobGeo, blobMat, MAX]} frustumCulled={false} renderOrder={1} />
      {(Object.keys(geo) as PartId[]).map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            if (m) refs.current[k] = m;
          }}
          args={[g[k], mat, MAX * PER[k]]}
          castShadow={k !== "face"}
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

/** A worker's spawn pop, as `Character` does it. */
export const workerScale = (w: Worker) => {
  const spawn = Math.min(1, w.spawnT / 0.6);
  return spawn < 1 ? Math.max(0.01, easeOutBack(spawn)) : 1;
};
