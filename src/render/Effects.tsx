"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { InstancedMesh, MeshLambertMaterial, Object3D } from "three";
import { fx } from "./fx";
import { G } from "./kit";

const chunkMat = new MeshLambertMaterial({ flatShading: true });
const puffMat = new MeshLambertMaterial({ flatShading: true });
const dummy = new Object3D();
const CAP = 1400;

export function Effects() {
  const chunks = useRef<InstancedMesh>(null);
  const puffs = useRef<InstancedMesh>(null);

  useFrame(() => {
    const cm = chunks.current;
    const pm = puffs.current;
    if (!cm || !pm) return;
    let c = 0;
    let p = 0;
    for (const q of fx.particles) {
      const k = q.life / q.max;
      if (q.kind === 0) {
        const s = q.size * (1 - k * k * k);
        dummy.position.set(q.x, q.y, q.z);
        dummy.rotation.set(q.life * q.spin, q.life * q.spin * 0.7, 0);
        dummy.scale.setScalar(Math.max(0.001, s));
        dummy.updateMatrix();
        cm.setMatrixAt(c, dummy.matrix);
        cm.setColorAt(c, q.color);
        c++;
      } else {
        const s = q.size * (1 + q.grow * k) * (1 - k * k);
        dummy.position.set(q.x, q.y, q.z);
        dummy.rotation.set(0, q.life, 0);
        dummy.scale.setScalar(Math.max(0.001, s));
        dummy.updateMatrix();
        pm.setMatrixAt(p, dummy.matrix);
        pm.setColorAt(p, q.color);
        p++;
      }
    }
    cm.count = c;
    pm.count = p;
    cm.instanceMatrix.needsUpdate = true;
    pm.instanceMatrix.needsUpdate = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={chunks} args={[G.box(1, 1, 1), chunkMat, CAP]} frustumCulled={false} castShadow />
      <instancedMesh ref={puffs} args={[G.ico(1, 0), puffMat, CAP]} frustumCulled={false} />
    </group>
  );
}
