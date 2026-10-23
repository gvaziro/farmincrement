"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Object3D, type Group, type InstancedMesh } from "three";
import type { MachineTypeId } from "@/game/data/machines";
import type { Machine } from "@/game/engine/types";
import { fx } from "../fx";
import { G, Part } from "../kit";
import { merge, P, part } from "../geom";
import { itemGeometry } from "../models/itemModels";
import { MeshLambertMaterial } from "three";
import { Chickens, Cows, PenFence, Sheep, Sign } from "./parts";
import { lanternMat, windowMat } from "../nightMaterials";
import { DYNAMIC } from "../StaticBatch";

const itemMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Shows an item model as a sign/ornament. */
function ItemProp({ id, scale = 1, ...rest }: { id: Parameters<typeof itemGeometry>[0]; scale?: number; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const g = useMemo(() => itemGeometry(id), [id]);
  return <mesh geometry={g} material={itemMat} scale={scale} castShadow {...rest} />;
}

/** Emits smoke from (x,y,z) while the machine works. */
function useSmoke(m: Machine, x: number, y: number, z: number, every = 0.28, color?: string) {
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!m.working && m.pulse < 0.2) return;
    t.current += dt;
    if (t.current > every) {
      t.current = 0;
      fx.smoke(m.def.x + x, y, m.def.z + z, color);
    }
  });
}

function House({ w, h, d, wall, roof, roofH = 1.2 }: { w: number; h: number; d: number; wall: string; roof: string; roofH?: number }) {
  // Wall-coloured gable inset in front of the roof's end face: reads as a
  // proper house front with a roof trim around it.
  const base = w - 0.15;
  const gableH = (roofH * base) / (w + 0.45);
  return (
    <group>
      <Part g={G.box(w + 0.1, 0.25, d + 0.1)} c="#c9a477" position={[0, 0.125, 0]} />
      <Part g={G.box(w, h, d)} c={wall} position={[0, h / 2 + 0.2, 0]} />
      <Part g={G.prism(w + 0.45, roofH, d + 0.4)} c={roof} position={[0, h + 0.2, 0]} />
      <Part g={G.prism(base, gableH * 0.94, 0.04)} c={wall} position={[0, h + 0.24, d / 2 + 0.215]} />
    </group>
  );
}

function Door({ x = 0, z, h = 1.15, c = "#8a5a33" }: { x?: number; z: number; h?: number; c?: string }) {
  return (
    <group position={[x, 0, z]}>
      <Part g={G.box(0.78, h + 0.1, 0.08)} c="#f3ead8" position={[0, (h + 0.1) / 2 + 0.2, 0]} />
      <Part g={G.box(0.62, h, 0.1)} c={c} position={[0, h / 2 + 0.22, 0.01]} />
      <Part g={G.sphere(0.04, 5, 4)} c="#ffd23f" position={[0.2, 0.75, 0.08]} />
    </group>
  );
}

function Window({ x, y, z, w = 0.6, h = 0.5 }: { x: number; y: number; z: number; w?: number; h?: number }) {
  return (
    <group position={[x, y, z]}>
      <Part g={G.box(w + 0.12, h + 0.12, 0.06)} c="#ffffff" />
      <Part g={G.box(w, h, 0.08)} c="#8fd3f5" m={windowMat} />
      <Part g={G.box(0.05, h, 0.09)} c="#ffffff" />
    </group>
  );
}

// ── individual machines ─────────────────────────────────────────────────
function Mill({ m }: { m: Machine }) {
  const blades = useRef<Group>(null);
  const speed = useRef(0.4);
  useFrame((_, dt) => {
    const target = m.working ? 3.2 : 0.35;
    speed.current += (target - speed.current) * Math.min(1, dt * 2);
    if (blades.current) blades.current.rotation.z += speed.current * dt;
  });
  return (
    <group>
      <Part g={G.cyl(1.55, 1.65, 0.3, 8)} c="#b9b1a3" position={[0, 0.15, 0]} />
      <Part g={G.cyl(1.0, 1.4, 3.2, 8)} c="#f3ead8" position={[0, 1.9, 0]} />
      <Part g={G.cyl(1.05, 1.05, 0.18, 8)} c="#c98b52" position={[0, 3.2, 0]} />
      <Part g={G.cone(1.3, 1.4, 8)} c="#e85d4a" position={[0, 4.2, 0]} />
      <Part g={G.sphere(0.14, 6, 4)} c="#ffd23f" position={[0, 4.95, 0]} />
      <Door z={1.3} h={1.0} />
      <Window x={0} y={2.5} z={1.12} w={0.45} h={0.45} />
      <Part g={G.cyl(0.2, 0.2, 0.5, 8)} c="#6b4a2a" position={[0, 3.6, 1.15]} rotation={[Math.PI / 2, 0, 0]} />
      <group ref={blades} userData={DYNAMIC} position={[0, 3.6, 1.42]}>
        <Part g={G.sphere(0.2, 8, 6)} c="#8a5a33" />
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <Part g={G.box(0.1, 2.3, 0.07)} c="#8a5a33" position={[0, 1.2, 0]} />
            <Part g={G.box(0.62, 1.75, 0.03)} c="#fff8ea" position={[0.36, 1.35, -0.02]} />
            <Part g={G.box(0.03, 1.75, 0.04)} c="#c9a477" position={[0.36, 1.35, 0]} />
          </group>
        ))}
      </group>
      <ItemProp id="flour" position={[-1.4, 0.3, 0.9]} rotation={[0, 0.6, 0]} scale={1.1} />
      <ItemProp id="flour" position={[-1.55, 0.3, 0.35]} rotation={[0, 1.2, 0]} scale={1.1} />
    </group>
  );
}

function Bakery({ m }: { m: Machine }) {
  useSmoke(m, 1.0, 3.6, -0.5);
  return (
    <group>
      <House w={3.4} h={2.0} d={2.8} wall="#ffe3a8" roof="#e8743a" />
      <Part g={G.box(0.5, 1.2, 0.5)} c="#b35a3a" position={[1.0, 3.0, -0.5]} />
      <Part g={G.box(0.62, 0.12, 0.62)} c="#8f4530" position={[1.0, 3.62, -0.5]} />
      <Door z={1.42} />
      <Window x={-1.05} y={1.3} z={1.42} />
      <Window x={1.05} y={1.3} z={1.42} />
      {[-1.2, -0.6, 0, 0.6, 1.2].map((x, i) => (
        <Part key={x} g={G.box(0.6, 0.06, 0.7)} c={i % 2 ? "#ffffff" : "#e8413c"} position={[x, 2.05, 1.6]} rotation={[0.45, 0, 0]} />
      ))}
      <group position={[0, 2.62, 1.55]}>
        <Part g={G.box(1.5, 0.6, 0.1)} c="#8a5a33" />
        <ItemProp id="bread" position={[0, -0.1, 0.1]} scale={1.6} rotation={[0.4, 0, 0]} />
      </group>
    </group>
  );
}

function FeedMill({ m }: { m: Machine }) {
  const silo = useRef<Group>(null);
  useSmoke(m, -0.75, 4.1, -0.3, 0.45, "#e8d8a8");
  useFrame((state) => {
    if (silo.current) silo.current.position.x = m.working ? Math.sin(state.clock.elapsedTime * 40) * 0.015 : 0;
  });
  return (
    <group>
      <group ref={silo} userData={DYNAMIC} position={[-0.75, 0, -0.3]}>
        <Part g={G.cyl(0.95, 0.95, 3.4, 10)} c="#d5dee3" position={[0, 1.7, 0]} />
        <Part g={G.sphere(0.95, 10, 5)} c="#aebcc4" position={[0, 3.4, 0]} scale={[1, 0.55, 1]} />
        <Part g={G.cyl(0.97, 0.97, 0.12, 10)} c="#8fa2ad" position={[0, 1.0, 0]} />
        <Part g={G.cyl(0.97, 0.97, 0.12, 10)} c="#8fa2ad" position={[0, 2.2, 0]} />
      </group>
      <group position={[0.85, 0, 0.35]}>
        <Part g={G.box(1.9, 1.6, 2.2)} c="#e0b06a" position={[0, 0.8, 0]} />
        <Part g={G.prism(2.4, 0.9, 2.3)} c="#5fae45" position={[0, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Door z={1.12} h={1.0} c="#7a4b2a" />
      </group>
      <Part g={G.box(0.3, 0.3, 1.4)} c="#9fb0b8" position={[0.1, 2.6, 0.1]} rotation={[0.6, 0, -0.5]} />
      <group position={[0.85, 2.3, 1.5]}>
        <ItemProp id="corn" scale={1.6} rotation={[Math.PI / 2, 0, 0.4]} />
      </group>
    </group>
  );
}

function Coop({ m }: { m: Machine }) {
  const hut = useRef<Group>(null);
  useFrame((state) => {
    if (hut.current) hut.current.scale.y = 1 + (m.working ? Math.sin(state.clock.elapsedTime * 12) * 0.02 : 0);
  });
  return (
    <group>
      <PenFence w={5.2} d={4.4} gap={0} />
      <Part g={G.box(5.1, 0.04, 4.3)} c="#d9c48f" position={[0, 0.02, 0]} shadow={false} />
      <group ref={hut} userData={DYNAMIC} position={[-1.35, 0, -1.05]}>
        {[
          [-0.9, -0.7],
          [0.9, -0.7],
          [-0.9, 0.7],
          [0.9, 0.7],
        ].map(([x, z], i) => (
          <Part key={i} g={G.box(0.12, 0.5, 0.12)} c="#8a5a33" position={[x, 0.25, z]} />
        ))}
        <Part g={G.box(2.1, 1.3, 1.7)} c="#d98b5f" position={[0, 1.15, 0]} />
        <Part g={G.prism(2.5, 0.9, 2.0)} c="#c0392b" position={[0, 1.8, 0]} />
        <Part g={G.box(0.5, 0.6, 0.06)} c="#5a3a22" position={[0.4, 0.95, 0.86]} />
        <Part g={G.box(0.45, 0.05, 1.0)} c="#a8642a" position={[0.4, 0.3, 1.25]} rotation={[0.55, 0, 0]} />
        <Window x={-0.5} y={1.35} z={0.86} w={0.4} h={0.35} />
      </group>
      <Part g={G.box(1.2, 0.25, 0.4)} c="#a8642a" position={[1.3, 0.12, -1.6]} />
      <Part g={G.box(1.1, 0.06, 0.32)} c="#e0c46a" position={[1.3, 0.26, -1.6]} />
      <Chickens count={6} bounds={{ minX: -0.2, maxX: 2.3, minZ: -1.8, maxZ: 1.9 }} seed={m.def.x * 13 + 5} />
      <group position={[-1.35, 2.45, -0.0]}>
        <ItemProp id="egg" scale={1.5} rotation={[0.5, 0, 0]} />
      </group>
    </group>
  );
}

function Barn({ m }: { m: Machine }) {
  void m;
  return (
    <group>
      <PenFence w={6.2} d={5.0} color="#f2f2f2" />
      <Part g={G.box(6.1, 0.04, 4.9)} c="#8ccf62" position={[0, 0.02, 0]} shadow={false} />
      <group position={[-1.5, 0, -0.9]}>
        <Part g={G.box(3.0, 2.3, 3.0)} c="#c0392b" position={[0, 1.15, 0]} />
        <Part g={G.prism(3.4, 1.5, 3.3)} c="#6e3524" position={[0, 2.3, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Part g={G.box(1.3, 1.5, 0.08)} c="#9b2d22" position={[0, 0.75, 1.51]} />
        <Part g={G.box(1.45, 0.1, 0.1)} c="#ffffff" position={[0, 1.5, 1.55]} />
        <Part g={G.box(0.1, 1.5, 0.1)} c="#ffffff" position={[-0.68, 0.75, 1.55]} />
        <Part g={G.box(0.1, 1.5, 0.1)} c="#ffffff" position={[0.68, 0.75, 1.55]} />
        <Part g={G.box(0.08, 1.9, 0.08)} c="#ffffff" position={[0, 0.75, 1.56]} rotation={[0, 0, 0.72]} />
        <Part g={G.box(0.08, 1.9, 0.08)} c="#ffffff" position={[0, 0.75, 1.56]} rotation={[0, 0, -0.72]} />
        <Part g={G.box(0.6, 0.6, 0.08)} c="#ffffff" position={[0, 2.3, 1.62]} />
        <Part g={G.box(0.45, 0.45, 0.1)} c="#5a2a1a" position={[0, 2.3, 1.63]} />
      </group>
      <Part g={G.box(1.0, 0.5, 0.8)} c="#e8d06a" position={[1.9, 0.25, -1.8]} />
      <Cows count={3} bounds={{ minX: 0.6, maxX: 2.4, minZ: -1.4, maxZ: 1.8 }} seed={m.def.z * 7 + 3} />
      <group position={[-1.5, 3.3, 0.8]}>
        <ItemProp id="milk" scale={1.5} rotation={[0.4, 0, 0]} />
      </group>
    </group>
  );
}

function Dairy({ m }: { m: Machine }) {
  const wheel = useRef<Group>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.y += (m.working ? 1.5 : 0.2) * dt;
  });
  useSmoke(m, 1.45, 1.9, 0.6, 0.4, "#ffffff");
  return (
    <group>
      <House w={3.2} h={2.0} d={2.8} wall="#f7f3e8" roof="#4a90d9" />
      <Door z={1.42} />
      <Window x={-1.0} y={1.3} z={1.42} />
      <Part g={G.cyl(0.45, 0.45, 1.0, 10)} c="#cfd8dc" position={[1.45, 0.7, 0.75]} />
      <Part g={G.cyl(0.47, 0.47, 0.08, 10)} c="#8fa2ad" position={[1.45, 1.2, 0.75]} />
      <group ref={wheel} userData={DYNAMIC} position={[0, 3.3, 0.2]}>
        <ItemProp id="cheese" scale={2.4} />
      </group>
    </group>
  );
}

function Juicer({ m }: { m: Machine }) {
  const apple = useRef<Group>(null);
  useFrame((state) => {
    if (apple.current) {
      const s = m.working ? 1 + Math.sin(state.clock.elapsedTime * 10) * 0.05 : 1;
      apple.current.scale.set(s, 2 - s, s);
    }
  });
  return (
    <group>
      <House w={3.0} h={1.8} d={2.6} wall="#fff1d6" roof="#5fae45" />
      <Door z={1.32} />
      <Window x={-0.95} y={1.2} z={1.32} />
      <Part g={G.cyl(0.42, 0.42, 1.2, 10)} c="#ffb347" position={[1.55, 0.8, 0.6]} />
      <Part g={G.cyl(0.44, 0.44, 0.1, 10)} c="#d9822b" position={[1.55, 1.4, 0.6]} />
      <group ref={apple} userData={DYNAMIC} position={[0, 3.05, 0]}>
        <Part g={G.sphere(0.65, 10, 8)} c="#e8413c" scale={[1, 0.9, 1]} />
        <Part g={G.cyl(0.05, 0.05, 0.3, 5)} c="#7a4b26" position={[0, 0.65, 0]} />
        <Part g={G.sphere(0.18, 6, 4)} c="#4fae3a" position={[0.18, 0.66, 0]} scale={[1.6, 0.4, 0.8]} />
      </group>
    </group>
  );
}

function Saucery({ m }: { m: Machine }) {
  useSmoke(m, -1.3, 2.1, 0.7, 0.3, "#ffffff");
  return (
    <group>
      <House w={3.2} h={1.9} d={2.8} wall="#ffe9e0" roof="#d7263d" />
      <Door z={1.42} />
      <Window x={1.0} y={1.3} z={1.42} />
      <Part g={G.cyl(0.5, 0.42, 0.8, 10)} c="#8fa2ad" position={[-1.3, 0.6, 0.75]} />
      <Part g={G.cyl(0.46, 0.46, 0.05, 10)} c="#d7263d" position={[-1.3, 1.0, 0.75]} />
      <group position={[0, 3.2, 0]}>
        <Part g={G.sphere(0.7, 10, 8)} c="#ff5a36" scale={[1, 0.78, 1]} />
        <Part g={G.cone(0.42, 0.22, 6)} c="#3f9b2f" position={[0, 0.58, 0]} rotation={[Math.PI, 0, 0]} />
        <Part g={G.cyl(0.05, 0.05, 0.22, 5)} c="#3f9b2f" position={[0, 0.7, 0]} />
      </group>
    </group>
  );
}

function Confectionery({ m }: { m: Machine }) {
  const cake = useRef<Group>(null);
  useFrame((_, dt) => {
    if (cake.current) cake.current.rotation.y += (m.working ? 1.2 : 0.3) * dt;
  });
  useSmoke(m, -1.6, 3.4, -0.6, 0.35, "#ffe3ef");
  return (
    <group>
      <House w={4.2} h={2.2} d={3.2} wall="#ffd6e5" roof="#ff8fb1" roofH={1.0} />
      <Part g={G.box(0.45, 1.0, 0.45)} c="#ffffff" position={[-1.6, 2.9, -0.6]} />
      <Door z={1.62} />
      <Window x={-1.3} y={1.4} z={1.62} />
      <Window x={1.3} y={1.4} z={1.62} />
      {[-1.75, -1.05, -0.35, 0.35, 1.05, 1.75].map((x, i) => (
        <Part key={x} g={G.box(0.7, 0.06, 0.7)} c={i % 2 ? "#ffffff" : "#ff5d8f"} position={[x, 2.25, 1.85]} rotation={[0.45, 0, 0]} />
      ))}
      <group ref={cake} userData={DYNAMIC} position={[0.9, 3.05, 0]}>
        <Part g={G.cyl(0.75, 0.75, 0.45, 12)} c="#f7d6a8" position={[0, 0.22, 0]} />
        <Part g={G.cyl(0.78, 0.78, 0.12, 12)} c="#ffffff" position={[0, 0.48, 0]} />
        <Part g={G.cyl(0.5, 0.5, 0.35, 12)} c="#ff8fb1" position={[0, 0.7, 0]} />
        <Part g={G.cyl(0.52, 0.52, 0.08, 12)} c="#ffffff" position={[0, 0.9, 0]} />
        <Part g={G.sphere(0.13, 8, 6)} c="#d7263d" position={[0, 1.02, 0]} />
      </group>
    </group>
  );
}

function Smokehouse({ m }: { m: Machine }) {
  // Thick grey smoke from the stone chimney while fish is smoking.
  useSmoke(m, 1.05, 4.3, -0.7, 0.18, "#b8b2a8");
  return (
    <group>
      <House w={3.0} h={1.9} d={2.6} wall="#9a6a3f" roof="#4f4a46" roofH={1.0} />
      {[0.55, 0.95, 1.35, 1.75].map((y) => (
        <Part key={y} g={G.box(3.04, 0.05, 2.64)} c="#7f5531" position={[0, y, 0]} />
      ))}
      <Part g={G.box(0.7, 3.2, 0.7)} c="#8f8a82" position={[1.05, 2.0, -0.7]} />
      <Part g={G.box(0.82, 0.16, 0.82)} c="#6f6a64" position={[1.05, 3.62, -0.7]} />
      <Door z={1.32} c="#5a3a22" />
      <Window x={-0.9} y={1.25} z={1.32} w={0.45} h={0.4} />
      {/* drying rack with fish */}
      <group position={[-1.95, 0, 0.4]}>
        <Part g={G.box(0.08, 1.5, 0.08)} c="#7a4b26" position={[0, 0.75, -0.55]} />
        <Part g={G.box(0.08, 1.5, 0.08)} c="#7a4b26" position={[0, 0.75, 0.55]} />
        <Part g={G.box(0.06, 0.06, 1.25)} c="#7a4b26" position={[0, 1.45, 0]} />
        {[-0.35, 0, 0.35].map((z) => (
          <ItemProp key={z} id="smokedfish" scale={0.85} position={[0.02, 1.18, z]} rotation={[0, Math.PI / 2, -Math.PI / 2]} />
        ))}
      </group>
      <group position={[0, 2.45, 1.45]}>
        <ItemProp id="fish" scale={1.7} rotation={[0.35, 0, 0]} />
      </group>
    </group>
  );
}

function Cannery({ m }: { m: Machine }) {
  const can = useRef<Group>(null);
  const belt = useRef<Group>(null);
  useFrame((_, dt) => {
    if (can.current) can.current.rotation.y += (m.working ? 1.4 : 0.25) * dt;
    if (belt.current && m.working) {
      for (const c of belt.current.children) {
        c.position.x += dt * 0.6;
        if (c.position.x > 0.75) c.position.x -= 1.5;
      }
    }
  });
  return (
    <group>
      <Part g={G.box(3.7, 0.25, 3.3)} c="#a9b3b8" position={[0, 0.125, 0]} />
      <Part g={G.box(3.4, 2.3, 3.0)} c="#d5e0e6" position={[0, 1.35, 0]} />
      <Part g={G.box(3.6, 0.2, 3.2)} c="#5d7a8c" position={[0, 2.6, 0]} />
      <Part g={G.box(3.6, 0.3, 0.1)} c="#3f8fd9" position={[0, 2.05, 1.52]} />
      <Door z={1.52} h={1.3} c="#5d7a8c" />
      {[-1.05, 1.05].map((x) => (
        <group key={x} position={[x, 1.25, 1.52]}>
          <Part g={G.box(0.7, 0.6, 0.06)} c="#ffffff" />
          <Part g={G.box(0.6, 0.5, 0.08)} c="#8fd3f5" m={windowMat} />
          <Part g={G.box(0.6, 0.04, 0.09)} c="#ffffff" />
          <Part g={G.box(0.04, 0.5, 0.09)} c="#ffffff" />
        </group>
      ))}
      <Part g={G.cyl(0.14, 0.14, 1.1, 8)} c="#8f9aa0" position={[-1.3, 3.1, -0.9]} />
      {/* conveyor out of the side hatch */}
      <group position={[2.35, 0, 0.3]}>
        <Part g={G.box(1.5, 0.12, 0.6)} c="#3a3f44" position={[0, 0.72, 0]} />
        <Part g={G.box(0.08, 0.7, 0.08)} c="#6f7a80" position={[-0.6, 0.35, 0.25]} />
        <Part g={G.box(0.08, 0.7, 0.08)} c="#6f7a80" position={[0.6, 0.35, -0.25]} />
        <group ref={belt} userData={DYNAMIC}>
          {[-0.6, -0.1, 0.4].map((x) => (
            <group key={x} position={[x, 0.78, 0]}>
              <ItemProp id="canned" scale={0.8} />
            </group>
          ))}
        </group>
      </group>
      <group ref={can} userData={DYNAMIC} position={[0, 2.75, 0.1]}>
        <Part g={G.cyl(0.62, 0.62, 0.9, 14)} c="#cfd8dc" position={[0, 0.45, 0]} />
        <Part g={G.cyl(0.64, 0.64, 0.5, 14)} c="#3f8fd9" position={[0, 0.45, 0]} />
        <Part g={G.cyl(0.5, 0.5, 0.04, 14)} c="#9fb0b8" position={[0, 0.92, 0]} />
        <group position={[0.62, 0.45, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ItemProp id="fish" scale={1.1} />
        </group>
      </group>
    </group>
  );
}

const BEES = 14;
const beeGeo = (() => {
  const g = merge([
    part(P.sphere(0.06, 6, 4), "#ffd23f", { s: [1.3, 1, 1] }),
    part(P.box(0.03, 0.1, 0.1), "#2b2b2b", { p: [0, 0, 0] }),
    part(P.box(0.08, 0.01, 0.06), "#ffffff", { p: [0, 0.06, 0.05], r: [0.3, 0, 0] }),
    part(P.box(0.08, 0.01, 0.06), "#ffffff", { p: [0, 0.06, -0.05], r: [-0.3, 0, 0] }),
  ]);
  return g;
})();
const beeObj = new Object3D();

/** Three hives on a platform, with bees buzzing around them. */
function Apiary({ m }: { m: Machine }) {
  const bees = useRef<InstancedMesh>(null);
  const hives = [-1.45, 0, 1.45];
  const colors = ["#fff4dc", "#ffe08a", "#cfe8ff"];
  useFrame((state) => {
    const im = bees.current;
    if (!im) return;
    const t = state.clock.elapsedTime;
    const busy = m.working ? 1 : 0.55;
    for (let i = 0; i < BEES; i++) {
      const h = hives[i % 3];
      const sp = (1.3 + (i % 5) * 0.25) * busy;
      const a = t * sp * 2 + i * 1.7;
      const rad = 0.45 + ((i * 7) % 5) * 0.12;
      beeObj.position.set(h + Math.cos(a) * rad, 1.25 + Math.sin(a * 1.7 + i) * 0.35 + (i % 3) * 0.15, 0.3 + Math.sin(a) * rad * 0.8);
      beeObj.rotation.set(0, -a, Math.sin(t * 40 + i) * 0.2);
      beeObj.scale.setScalar(i < BEES * busy + 1 ? 1.6 : 0.001);
      beeObj.updateMatrix();
      im.setMatrixAt(i, beeObj.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <Part g={G.box(4.5, 0.22, 2.7)} c="#b07a45" position={[0, 0.11, 0]} />
      {hives.map((x, i) => (
        <group key={x} position={[x, 0.22, -0.1]}>
          <Part g={G.box(1.0, 0.45, 0.85)} c={colors[i]} position={[0, 0.25, 0]} />
          <Part g={G.box(1.0, 0.4, 0.85)} c={colors[(i + 1) % 3]} position={[0, 0.7, 0]} />
          <Part g={G.box(1.12, 0.12, 0.97)} c="#c98b52" position={[0, 0.96, 0]} />
          <Part g={G.prism(1.15, 0.28, 1.0)} c="#a8642a" position={[0, 1.02, 0]} rotation={[0, Math.PI / 2, 0]} />
          <Part g={G.box(0.4, 0.06, 0.04)} c="#3a2a16" position={[0, 0.1, 0.44]} />
          <Part g={G.box(0.5, 0.04, 0.2)} c="#d6a86f" position={[0, 0.04, 0.52]} rotation={[0.3, 0, 0]} />
        </group>
      ))}
      <Part g={G.box(0.12, 1.2, 0.12)} c="#7a4b26" position={[2.05, 0.6, 1.1]} />
      <group position={[2.05, 1.35, 1.12]}>
        <ItemProp id="honeycomb" scale={1.6} rotation={[Math.PI / 2 - 0.3, 0, 0]} />
      </group>
      <instancedMesh ref={bees} args={[beeGeo, itemMat, BEES]} userData={DYNAMIC} frustumCulled={false} />
    </group>
  );
}

function HoneyHouse({ m }: { m: Machine }) {
  const drum = useRef<Group>(null);
  useFrame((_, dt) => {
    if (drum.current) drum.current.rotation.y += (m.working ? 6 : 0) * dt;
  });
  return (
    <group>
      <House w={3.2} h={2.0} d={2.8} wall="#e8b04a" roof="#7a3b2a" />
      {[0.6, 1.0, 1.4, 1.8].map((y) => (
        <Part key={y} g={G.box(3.24, 0.04, 2.84)} c="#cf9234" position={[0, y, 0]} />
      ))}
      <Door z={1.42} />
      <Window x={-1.0} y={1.3} z={1.42} />
      {/* honey dripping from the eaves */}
      {[-1.4, -0.7, 0.6, 1.3].map((x, i) => (
        <Part key={x} g={G.cone(0.07, 0.22 + (i % 2) * 0.12, 6)} c="#f0a020" position={[x, 2.05 - (i % 2) * 0.06, 1.55]} rotation={[Math.PI, 0, 0]} />
      ))}
      {/* extractor drum with a crank */}
      <group position={[1.95, 0, 0.7]}>
        <Part g={G.cyl(0.45, 0.45, 0.95, 12)} c="#cfd8dc" position={[0, 0.48, 0]} />
        <Part g={G.cyl(0.47, 0.47, 0.06, 12)} c="#8fa2ad" position={[0, 0.96, 0]} />
        <group ref={drum} userData={DYNAMIC} position={[0, 1.05, 0]}>
          <Part g={G.box(0.6, 0.06, 0.06)} c="#5d6b75" position={[0.25, 0.08, 0]} />
          <Part g={G.cyl(0.04, 0.04, 0.2, 6)} c="#a8642a" position={[0.55, 0.2, 0]} />
        </group>
      </group>
      <group position={[0, 3.1, 0.25]}>
        <ItemProp id="honey" scale={2.6} />
      </group>
    </group>
  );
}

/** A pen with a shed and fluffy sheep. */
function Sheepfold({ m }: { m: Machine }) {
  return (
    <group>
      <PenFence w={6.2} d={5.0} color="#e8d2a6" />
      <Part g={G.box(6.1, 0.04, 4.9)} c="#9ad468" position={[0, 0.02, 0]} shadow={false} />
      <group position={[-1.6, 0, -1.0]}>
        <Part g={G.box(2.8, 1.9, 2.6)} c="#f1e3c8" position={[0, 0.95, 0]} />
        <Part g={G.prism(3.2, 1.25, 2.9)} c="#5a8fd0" position={[0, 1.9, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Part g={G.box(1.0, 1.3, 0.08)} c="#8a5a33" position={[0.3, 0.65, 1.31]} />
        <Part g={G.box(1.1, 0.08, 0.1)} c="#ffffff" position={[0.3, 1.32, 1.33]} />
        <Window x={-0.85} y={1.2} z={1.31} w={0.45} h={0.4} />
      </group>
      {/* hay rack */}
      <Part g={G.box(1.1, 0.5, 0.7)} c="#a8642a" position={[1.9, 0.25, -1.8]} />
      <Part g={G.box(1.0, 0.25, 0.6)} c="#e8d06a" position={[1.9, 0.6, -1.8]} />
      <Sheep count={5} bounds={{ minX: 0.3, maxX: 2.5, minZ: -1.1, maxZ: 1.9 }} seed={m.def.z * 11 + 7} />
      <group position={[-1.6, 3.55, 0.3]}>
        <ItemProp id="wool" scale={1.9} />
      </group>
    </group>
  );
}

/** A lilac workshop with a big spinning wheel that turns while it works. */
function Spinnery({ m }: { m: Machine }) {
  const wheel = useRef<Group>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z -= (m.working ? 3.2 : 0.25) * dt;
  });
  return (
    <group>
      <House w={3.2} h={2.0} d={2.8} wall="#ece0f5" roof="#8e6cc9" />
      <Door z={1.42} x={-0.5} />
      <Window x={0.75} y={1.3} z={1.42} w={0.5} />
      <group position={[2.05, 0, 0.55]}>
        <Part g={G.box(0.7, 0.12, 0.5)} c="#8a5a33" position={[0, 0.06, 0]} />
        <Part g={G.box(0.1, 1.1, 0.1)} c="#a8642a" position={[0, 0.6, -0.12]} />
        <group ref={wheel} userData={DYNAMIC} position={[0, 1.15, 0.0]}>
          <Part g={G.torus(0.55, 0.05, 6, 18)} c="#b5763a" />
          {[0, 1, 2, 3].map((i) => (
            <Part key={i} g={G.box(0.04, 1.08, 0.04)} c="#c98b52" rotation={[0, 0, (i * Math.PI) / 4]} />
          ))}
          <Part g={G.cyl(0.08, 0.08, 0.12, 8)} c="#7a4b26" rotation={[Math.PI / 2, 0, 0]} />
        </group>
        <Part g={G.cyl(0.1, 0.12, 0.25, 8)} c="#e86fa6" position={[-0.28, 0.3, 0.15]} />
      </group>
      <group position={[0, 3.3, 0.15]}>
        <ItemProp id="yarn" scale={2.3} />
      </group>
    </group>
  );
}

/** A cosy knitting house: a giant ball of yarn with clicking needles on top. */
function Knitting({ m }: { m: Machine }) {
  const needles = useRef<Group>(null);
  useSmoke(m, 1.15, 3.7, -0.7, 0.45, "#ffffff");
  useFrame((state) => {
    if (needles.current) needles.current.rotation.z = m.working ? Math.sin(state.clock.elapsedTime * 9) * 0.22 : 0;
  });
  return (
    <group>
      <House w={3.6} h={2.1} d={2.8} wall="#ffe6d8" roof="#d9485f" />
      <Part g={G.box(0.45, 1.2, 0.45)} c="#b35a3a" position={[1.15, 3.0, -0.7]} />
      <Part g={G.box(0.56, 0.12, 0.56)} c="#8f4530" position={[1.15, 3.62, -0.7]} />
      <Door z={1.42} />
      <Window x={-1.1} y={1.35} z={1.42} />
      <Window x={1.1} y={1.35} z={1.42} />
      <group position={[0, 2.62, 1.55]}>
        <ItemProp id="sweater" scale={1.5} rotation={[1.1, 0, 0]} />
      </group>
      <group position={[-0.4, 3.35, -0.1]}>
        <ItemProp id="yarn" scale={2.6} />
        <group ref={needles} userData={DYNAMIC} position={[0, 0.45, 0]}>
          <Part g={G.cyl(0.035, 0.035, 1.3, 6)} c="#cfd8dc" rotation={[0, 0, 0.55]} />
          <Part g={G.cyl(0.035, 0.035, 1.3, 6)} c="#cfd8dc" rotation={[0, 0, -0.55]} />
          <Part g={G.sphere(0.07, 6, 4)} c="#ffd23f" position={[-0.33, 0.55, 0]} />
          <Part g={G.sphere(0.07, 6, 4)} c="#ffd23f" position={[0.33, 0.55, 0]} />
        </group>
      </group>
    </group>
  );
}

/** A cottage with a copper pot of jam bubbling on a fire outside. */
function Jamhouse({ m }: { m: Machine }) {
  const ladle = useRef<Group>(null);
  useSmoke(m, 2.0, 1.4, 0.75, 0.25, "#ffe3ef");
  useFrame((state) => {
    if (ladle.current) ladle.current.rotation.y = m.working ? state.clock.elapsedTime * 2.5 : 0.6;
  });
  return (
    <group>
      <House w={3.2} h={2.0} d={2.8} wall="#fff0e6" roof="#c2185b" />
      <Door z={1.42} x={-0.6} />
      <Window x={0.75} y={1.3} z={1.42} w={0.5} />
      <group position={[2.05, 0, 0.75]}>
        <Part g={G.cyl(0.42, 0.46, 0.22, 8)} c="#8f8a82" position={[0, 0.11, 0]} />
        <Part g={G.cone(0.2, 0.32, 5)} c="#ff9f1c" position={[0, 0.36, 0]} />
        <Part g={G.cyl(0.4, 0.3, 0.55, 12)} c="#c87533" position={[0, 0.82, 0]} />
        <Part g={G.cyl(0.37, 0.37, 0.04, 12)} c="#9c1747" position={[0, 1.08, 0]} />
        <group ref={ladle} userData={DYNAMIC} position={[0, 1.08, 0]}>
          <Part g={G.cyl(0.025, 0.025, 0.75, 5)} c="#7a4b26" position={[0.12, 0.25, 0]} rotation={[0, 0, -0.45]} />
        </group>
      </group>
      <group position={[0, 3.15, 0.2]}>
        <ItemProp id="jam" scale={2.6} />
      </group>
    </group>
  );
}

/** A pastel ice-cream parlour with a giant cone turning on the roof. */
function IceCream({ m }: { m: Machine }) {
  const cone = useRef<Group>(null);
  useFrame((_, dt) => {
    if (cone.current) cone.current.rotation.y += (m.working ? 1.2 : 0.3) * dt;
  });
  return (
    <group>
      <Part g={G.box(4.5, 0.25, 3.5)} c="#e8d9c8" position={[0, 0.125, 0]} />
      <Part g={G.box(4.2, 2.2, 3.2)} c="#ffd6e5" position={[0, 1.35, 0]} />
      <Part g={G.box(4.4, 0.22, 3.4)} c="#ffffff" position={[0, 2.55, 0]} />
      {[-1.75, -1.05, -0.35, 0.35, 1.05, 1.75].map((x, i) => (
        <Part key={x} g={G.box(0.7, 0.06, 0.7)} c={i % 2 ? "#ffffff" : "#8ed1fc"} position={[x, 2.3, 1.85]} rotation={[0.45, 0, 0]} />
      ))}
      <Door z={1.62} />
      <Window x={-1.3} y={1.4} z={1.62} />
      <Window x={1.3} y={1.4} z={1.62} />
      <group ref={cone} userData={DYNAMIC} position={[0.7, 2.66, 0]}>
        <Part g={G.cone(0.45, 1.2, 10)} c="#e0a96d" position={[0, 0.6, 0]} rotation={[Math.PI, 0, 0]} />
        <Part g={G.sphere(0.5, 10, 8)} c="#ffc0d9" position={[0, 1.3, 0]} />
        <Part g={G.sphere(0.42, 10, 8)} c="#fff4dc" position={[0, 1.88, 0]} />
        <Part g={G.sphere(0.13, 8, 6)} c="#e8323c" position={[0, 2.34, 0]} />
      </group>
      <group position={[-1.2, 2.66, 0.3]}>
        <ItemProp id="strawberry" scale={1.6} />
      </group>
    </group>
  );
}

/** A warm bakery with a giant pumpkin pie turning on the roof. */
function PieBakery({ m }: { m: Machine }) {
  const pie = useRef<Group>(null);
  useSmoke(m, -1.5, 3.6, -0.7, 0.3);
  useFrame((_, dt) => {
    if (pie.current) pie.current.rotation.y += (m.working ? 1.0 : 0.25) * dt;
  });
  return (
    <group>
      <House w={4.2} h={2.1} d={3.0} wall="#fff1d6" roof="#e8742a" roofH={1.0} />
      <Part g={G.box(0.45, 1.1, 0.45)} c="#b35a3a" position={[-1.5, 2.95, -0.7]} />
      <Part g={G.box(0.56, 0.12, 0.56)} c="#8f4530" position={[-1.5, 3.52, -0.7]} />
      <Door z={1.52} />
      <Window x={-1.3} y={1.4} z={1.52} />
      <Window x={1.3} y={1.4} z={1.52} />
      <ItemProp id="pumpkin" position={[-0.75, 0.25, 1.85]} scale={1.4} rotation={[0, 0.5, 0]} />
      <ItemProp id="pumpkin" position={[0.75, 0.25, 1.9]} scale={1.1} rotation={[0, -0.4, 0]} />
      <group ref={pie} userData={DYNAMIC} position={[0.8, 3.0, 0]}>
        <ItemProp id="pie" scale={3.4} />
      </group>
    </group>
  );
}

/** A dark wooden workshop hung with glowing jack-o'-lanterns. */
function LanternShop({ m }: { m: Machine }) {
  const big = useRef<Group>(null);
  useFrame((state) => {
    if (big.current) big.current.scale.setScalar(m.working ? 1 + Math.sin(state.clock.elapsedTime * 6) * 0.05 : 1);
  });
  return (
    <group>
      <House w={3.2} h={2.0} d={2.8} wall="#7a5340" roof="#4a3a6a" />
      <Door z={1.42} c="#3a2a1a" />
      <Window x={-1.0} y={1.3} z={1.42} />
      {/* a garland of little lights under the eaves */}
      <Part g={G.box(3.3, 0.03, 0.03)} c="#3a2a1a" position={[0, 2.12, 1.5]} />
      {[-1.4, -0.7, 0, 0.7, 1.4].map((x) => (
        <Part key={x} g={G.box(0.14, 0.16, 0.14)} c="#ffd23f" m={lanternMat} position={[x, 2.0, 1.52]} shadow={false} />
      ))}
      <ItemProp id="lantern" position={[1.85, 0.25, 1.7]} scale={1.3} />
      <ItemProp id="lantern" position={[-1.85, 0.25, 1.7]} scale={1.1} />
      <group ref={big} userData={DYNAMIC} position={[0, 3.15, 0.15]}>
        <ItemProp id="lantern" scale={2.6} />
      </group>
    </group>
  );
}

export const MACHINE_MODELS: Record<MachineTypeId, (p: { m: Machine }) => React.JSX.Element> = {
  mill: Mill,
  bakery: Bakery,
  feedmill: FeedMill,
  coop: Coop,
  barn: Barn,
  dairy: Dairy,
  juicer: Juicer,
  saucery: Saucery,
  confectionery: Confectionery,
  smokehouse: Smokehouse,
  cannery: Cannery,
  apiary: Apiary,
  honeyhouse: HoneyHouse,
  sheepfold: Sheepfold,
  spinnery: Spinnery,
  knitting: Knitting,
  jamhouse: Jamhouse,
  icecream: IceCream,
  piebakery: PieBakery,
  lanternshop: LanternShop,
};

export { Sign };
