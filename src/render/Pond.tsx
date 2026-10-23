"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, MeshLambertMaterial, type Group } from "three";
import { mulberry32 } from "@/game/core/math";
import { POND } from "@/game/data/layout";
import { G, Part, Plain, mat } from "./kit";
import { seasonVisual } from "./seasonLook";
import { roundedRectGeometry } from "./shapes";
import { DYNAMIC, StaticBatch } from "./StaticBatch";

const W = POND.water;
const PIER = POND.pier;
const WATER = new Color("#5cc6f2");
const ICE = new Color("#d8eef7");

/** The pond on the south-west plot: water (ice in winter), sandy shore, a pier and ducks. */
export function Pond() {
  const water = useMemo(() => new MeshLambertMaterial({ color: "#5cc6f2", emissive: "#1f6f9a" }), []);
  useFrame((state) => {
    // Gentle shimmer; in winter the pond freezes over.
    const t = state.clock.elapsedTime;
    const live = 1 - seasonVisual.winter;
    water.color.lerpColors(WATER, ICE, seasonVisual.winter);
    water.emissive.setRGB(
      (0.07 + Math.sin(t * 0.8) * 0.012) * live + 0.04 * (1 - live),
      (0.2 + Math.sin(t * 0.6) * 0.02) * live + 0.06 * (1 - live),
      (0.32 + Math.sin(t * 0.7) * 0.02) * live + 0.09 * (1 - live),
    );
  });
  const w = W.x1 - W.x0;
  const d = W.z1 - W.z0;
  const cx = (W.x0 + W.x1) / 2;
  const cz = (W.z0 + W.z1) / 2;
  const pierLen = PIER.x1 - PIER.x0 + 0.8;
  const pierZ = (PIER.z0 + PIER.z1) / 2;
  const pierW = PIER.z1 - PIER.z0;

  return (
    <group>
      <StaticBatch shadow={false}>
        <mesh geometry={roundedRectGeometry(w + 1.6, d + 1.6, 2.2)} material={mat("#d9c48f")} position={[cx, 0.012, cz]} receiveShadow />
        <mesh geometry={roundedRectGeometry(w + 0.7, d + 0.7, 1.8)} material={mat("#c8b47c")} position={[cx, 0.018, cz]} receiveShadow />
      </StaticBatch>
      <mesh geometry={roundedRectGeometry(w, d, 1.5)} material={water} position={[cx, 0.03, cz]} receiveShadow />
      {/* pier: planks on posts */}
      <StaticBatch>
        {Array.from({ length: Math.round(pierLen / 0.45) }, (_, i) => (
          <Part key={i} g={G.box(0.4, 0.1, pierW)} c={i % 2 ? "#c98b52" : "#b57a45"} position={[PIER.x0 + 0.22 + i * 0.45, 0.22, pierZ]} />
        ))}
        {[0.2, 0.5, 0.8].map((k) =>
          [-1, 1].map((s) => (
            <Part key={`${k}${s}`} g={G.cyl(0.09, 0.09, 0.7, 6)} c="#7a4b26" position={[PIER.x0 + (pierLen - 0.8) * k, 0.05, pierZ + s * (pierW / 2 - 0.05)]} />
          )),
        )}
        <Part g={G.box(0.1, 0.5, 0.1)} c="#7a4b26" position={[PIER.x0 + 0.1, 0.45, pierZ - pierW / 2 + 0.1]} />
        <Part g={G.box(0.1, 0.5, 0.1)} c="#7a4b26" position={[PIER.x0 + 0.1, 0.45, pierZ + pierW / 2 - 0.1]} />
        <Part g={G.box(0.06, 0.06, pierW - 0.2)} c="#a8642a" position={[PIER.x0 + 0.1, 0.62, pierZ]} />
        {/* a little boat by the pier */}
        <group position={[PIER.x0 + 1.2, 0.06, pierZ + 2.6]} rotation={[0, 0.25, 0]}>
          <Part g={G.box(1.7, 0.28, 0.75)} c="#e8413c" position={[0, 0.1, 0]} />
          <Part g={G.box(1.5, 0.08, 0.6)} c="#f3ead8" position={[0, 0.25, 0]} />
          <Part g={G.cone(0.38, 0.5, 4)} c="#e8413c" position={[1.05, 0.1, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.55]} />
        </group>
      </StaticBatch>
      <Ducks />
    </group>
  );
}

interface Duck {
  x: number;
  z: number;
  tx: number;
  tz: number;
  yaw: number;
  wait: number;
}

/** Ducks paddling around the quiet parts of the pond. */
function Ducks() {
  const ducks = useMemo<Duck[]>(() => {
    const rnd = mulberry32(77);
    return Array.from({ length: 4 }, (_, i) => {
      const north = i % 2 === 0;
      const x = W.x0 + 1 + rnd() * 3;
      const z = north ? W.z0 + 1 + rnd() * 4 : W.z1 - 1 - rnd() * 4;
      return { x, z, tx: x, tz: z, yaw: rnd() * 6.28, wait: rnd() * 3 };
    });
  }, []);
  const refs = useRef<(Group | null)[]>([]);
  const flock = useRef<Group>(null);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // Ducks fly south for the winter.
    if (flock.current) flock.current.visible = seasonVisual.winter < 0.3;
    ducks.forEach((d, i) => {
      const dx = d.tx - d.x;
      const dz = d.tz - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        d.wait -= dt;
        if (d.wait <= 0) {
          const north = i % 2 === 0;
          d.tx = W.x0 + 0.9 + Math.random() * (PIER.x0 - W.x0 + 2.5);
          d.tz = north ? W.z0 + 0.9 + Math.random() * (PIER.z0 - W.z0 - 2.6) : PIER.z1 + 1.7 + Math.random() * (W.z1 - PIER.z1 - 2.6);
          d.wait = 1.5 + Math.random() * 3;
        }
      } else {
        const step = Math.min(dist, 0.45 * dt);
        d.x += (dx / dist) * step;
        d.z += (dz / dist) * step;
        let delta = Math.atan2(dx, dz) - d.yaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        d.yaw += delta * Math.min(1, dt * 4);
      }
      const g = refs.current[i];
      if (g) {
        g.position.set(d.x, 0.06 + Math.sin(t * 2.2 + i) * 0.02, d.z);
        g.rotation.set(Math.sin(t * 1.7 + i) * 0.05, d.yaw, 0);
      }
    });
  });
  return (
    <Plain>
    <group ref={flock} userData={DYNAMIC}>
      {ducks.map((_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} scale={0.9}>
          <StaticBatch>
            <Part g={G.sphere(0.22, 8, 6)} c={i === 1 ? "#a8763e" : "#ffffff"} position={[0, 0.12, 0]} scale={[0.85, 0.7, 1.25]} />
            <Part g={G.cone(0.1, 0.22, 4)} c={i === 1 ? "#8a5a2a" : "#f2f2f2"} position={[0, 0.2, -0.3]} rotation={[-1.1, 0, 0]} />
            <Part g={G.sphere(0.12, 7, 5)} c={i === 1 ? "#2f7d4f" : "#ffffff"} position={[0, 0.36, 0.2]} />
            <Part g={G.box(0.08, 0.04, 0.14)} c="#f29e4c" position={[0, 0.34, 0.34]} />
            <Part g={G.sphere(0.022, 4, 3)} c="#1d2b33" position={[0.07, 0.39, 0.27]} />
            <Part g={G.sphere(0.022, 4, 3)} c="#1d2b33" position={[-0.07, 0.39, 0.27]} />
          </StaticBatch>
        </group>
      ))}
    </group>
    </Plain>
  );
}
