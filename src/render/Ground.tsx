"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D } from "three";
import { ZONE_D, ZONE_W, ZONES, type ZoneId } from "@/game/data/layout";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { G, mat } from "./kit";
import { grassTextureRepeat } from "./textures";

const LOCKED = new Color("#5c9a47");
const OUTSIDE = "#6db553";

const TILE = 8;

/** Grass material whose texture lines up in world space across planes. */
function groundMaterial(color: string | Color, cx: number, cz: number, w: number, d: number) {
  const tex = grassTextureRepeat(w / TILE, d / TILE);
  const fract = (v: number) => v - Math.floor(v);
  tex.offset.set(fract((cx - w / 2) / TILE), fract(-(cz + d / 2) / TILE));
  return new MeshLambertMaterial({ color, map: tex });
}

export function Ground({ runtime }: { runtime: Runtime }) {
  const outside = useMemo(() => groundMaterial(OUTSIDE, 0, 0, 400, 400), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow material={outside}>
        <planeGeometry args={[400, 400]} />
      </mesh>
      {ZONES.map((z) => (
        <ZonePlane key={z.id} runtime={runtime} id={z.id} gx={z.gx} gz={z.gz} tint={z.tint} />
      ))}
      <Fences runtime={runtime} />
    </group>
  );
}

function ZonePlane({ runtime, id, gx, gz, tint }: { runtime: Runtime; id: ZoneId; gx: number; gz: number; tint: string }) {
  const material = useMemo(() => groundMaterial(LOCKED.clone(), gx * ZONE_W, gz * ZONE_D, ZONE_W, ZONE_D), [gx, gz]);
  const target = useMemo(() => new Color(tint), [tint]);
  useFrame((_, dt) => {
    const open = runtime.game.state.zones.has(id);
    material.color.lerp(open ? target : LOCKED, Math.min(1, dt * 2.5));
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[gx * ZONE_W, 0, gz * ZONE_D]} receiveShadow material={material}>
      <planeGeometry args={[ZONE_W, ZONE_D]} />
    </mesh>
  );
}

const POST_GAP = 1.3;
const dummy = new Object3D();

/** Fence along every edge between unlocked land and anything else. */
function Fences({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const posts = useRef<InstancedMesh>(null);
  const rails = useRef<InstancedMesh>(null);

  const segments = useMemo(() => {
    void structure;
    const zones = runtime.game.state.zones;
    const open = new Set(ZONES.filter((z) => zones.has(z.id)).map((z) => `${z.gx},${z.gz}`));
    const segs: { x1: number; z1: number; x2: number; z2: number }[] = [];
    for (const key of open) {
      const [gx, gz] = key.split(",").map(Number);
      const cx = gx * ZONE_W;
      const cz = gz * ZONE_D;
      const hw = ZONE_W / 2;
      const hd = ZONE_D / 2;
      if (!open.has(`${gx},${gz - 1}`)) segs.push({ x1: cx - hw, z1: cz - hd, x2: cx + hw, z2: cz - hd });
      if (!open.has(`${gx},${gz + 1}`)) segs.push({ x1: cx - hw, z1: cz + hd, x2: cx + hw, z2: cz + hd });
      if (!open.has(`${gx - 1},${gz}`)) segs.push({ x1: cx - hw, z1: cz - hd, x2: cx - hw, z2: cz + hd });
      if (!open.has(`${gx + 1},${gz}`)) segs.push({ x1: cx + hw, z1: cz - hd, x2: cx + hw, z2: cz + hd });
    }
    return segs;
  }, [runtime, structure]);

  useLayoutEffect(() => {
    const pm = posts.current!;
    const rm = rails.current!;
    let pi = 0;
    let ri = 0;
    for (const s of segments) {
      const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
      const n = Math.max(1, Math.round(len / POST_GAP));
      const yaw = Math.atan2(s.z2 - s.z1, s.x2 - s.x1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        dummy.position.set(s.x1 + (s.x2 - s.x1) * t, 0.42, s.z1 + (s.z2 - s.z1) * t);
        dummy.rotation.set(0, -yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pm.setMatrixAt(pi++, dummy.matrix);
      }
      for (const y of [0.32, 0.62]) {
        dummy.position.set((s.x1 + s.x2) / 2, y, (s.z1 + s.z2) / 2);
        dummy.rotation.set(0, -yaw, 0);
        dummy.scale.set(len, 1, 1);
        dummy.updateMatrix();
        rm.setMatrixAt(ri++, dummy.matrix);
      }
    }
    pm.count = pi;
    rm.count = ri;
    pm.instanceMatrix.needsUpdate = true;
    rm.instanceMatrix.needsUpdate = true;
    pm.computeBoundingSphere();
    rm.computeBoundingSphere();
  }, [segments]);

  return (
    <group>
      <instancedMesh ref={posts} args={[G.box(0.14, 0.84, 0.14), mat("#c98b52"), 600]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={rails} args={[G.box(1, 0.09, 0.06), mat("#e0a96d"), 120]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}
