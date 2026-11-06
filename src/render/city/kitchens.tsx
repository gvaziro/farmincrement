"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MeshLambertMaterial, type Group } from "three";
import type { Machine } from "@/game/engine/types";
import type { ItemId } from "@/game/data/items";
import { fx } from "../fx";
import { G, Part } from "../kit";
import { itemGeometry } from "../models/itemModels";
import { windowMat } from "../nightMaterials";
import { DYNAMIC } from "../StaticBatch";

const itemMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

function Prop({ id, scale = 1, position, rotation }: { id: ItemId; scale?: number; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const g = useMemo(() => itemGeometry(id), [id]);
  return <mesh geometry={g} material={itemMat} scale={scale} position={position} rotation={rotation} castShadow />;
}

function useSteam(m: Machine, x: number, y: number, z: number, color = "#ffffff") {
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!m.working) return;
    t.current += dt;
    if (t.current > 0.3) {
      t.current = 0;
      fx.smoke(m.def.x + x, y, m.def.z + z, color);
    }
  });
}

/** A kitchen is a wide stall: a tiled base, a back wall with a shelf, an appliance on top. */
function Stall({ w, d, wall, top = "#e8ecef", awning, children }: { w: number; d: number; wall: string; top?: string; awning?: string; children?: React.ReactNode }) {
  const stripes = Math.round(w / 0.6);
  return (
    <group>
      <Part g={G.box(w, 1.0, d)} c={wall} position={[0, 0.5, 0]} />
      <Part g={G.box(w + 0.1, 0.1, d + 0.1)} c={top} position={[0, 1.04, 0]} />
      <Part g={G.box(w, 1.9, 0.26)} c={wall} position={[0, 1.95, -d / 2 + 0.13]} />
      {awning &&
        Array.from({ length: stripes }, (_, i) => (
          <Part key={i} g={G.box(w / stripes + 0.01, 0.06, 0.8)} c={i % 2 ? "#ffffff" : awning} position={[-w / 2 + (i + 0.5) * (w / stripes), 2.86, -d / 2 + 0.6]} rotation={[0.4, 0, 0]} />
        ))}
      {children}
    </group>
  );
}

function Coffee({ m }: { m: Machine }) {
  useSteam(m, 0.3, 2.6, 0.2);
  return (
    <Stall w={3.2} d={2.8} wall="#a87a58" awning="#c98f5a">
      <Part g={G.box(1.5, 1.1, 0.9)} c="#c9ced2" position={[0.2, 1.65, -0.2]} />
      <Part g={G.box(1.3, 0.14, 0.5)} c="#3a3f44" position={[0.2, 2.26, -0.2]} />
      <Part g={G.cyl(0.08, 0.08, 0.3, 6)} c="#6a7480" position={[-0.1, 1.45, 0.3]} rotation={[Math.PI / 2, 0, 0]} />
      <Part g={G.cyl(0.08, 0.08, 0.3, 6)} c="#6a7480" position={[0.5, 1.45, 0.3]} rotation={[Math.PI / 2, 0, 0]} />
      <Prop id="latte" position={[-1.05, 1.1, 0.2]} scale={1.4} />
    </Stall>
  );
}

function Sandwich({ m }: { m: Machine }) {
  void m;
  return (
    <Stall w={4.4} d={3.2} wall="#e0b070" awning="#5fae45">
      <Part g={G.box(2.2, 0.14, 1.1)} c="#c98b52" position={[-0.6, 1.16, 0.3]} />
      <Prop id="bread" position={[-1.2, 1.22, 0.3]} scale={1.2} />
      <Prop id="cheese" position={[-0.2, 1.22, 0.3]} scale={1.2} />
      <Prop id="sandwich" position={[1.4, 1.1, 0.2]} scale={1.8} />
    </Stall>
  );
}

function Oven({ m }: { m: Machine }) {
  useSteam(m, 1.4, 3.6, -1.0, "#d8d8d8");
  const glow = useRef<Group>(null);
  useFrame((state) => {
    if (glow.current) glow.current.scale.setScalar(m.working ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.08 : 0.7);
  });
  return (
    <group>
      <Part g={G.box(4.6, 1.0, 3.4)} c="#b5322a" position={[0, 0.5, 0]} />
      <Part g={G.box(4.7, 0.1, 3.5)} c="#e8ecef" position={[0, 1.04, 0]} />
      {/* Brick dome */}
      <Part g={G.sphere(1.25, 10, 6)} c="#c98a60" position={[0, 1.05, -0.5]} scale={[1.1, 1.0, 1]} />
      <Part g={G.box(1.1, 0.8, 0.2)} c="#3a2a22" position={[0, 1.5, 0.72]} />
      <group ref={glow} position={[0, 1.42, 0.82]} userData={DYNAMIC}>
        <mesh geometry={G.box(0.8, 0.5, 0.05)}>
          <meshLambertMaterial color="#ff9f1c" emissive="#ff6a00" emissiveIntensity={0.9} flatShading />
        </mesh>
      </group>
      <Part g={G.box(0.6, 1.6, 0.6)} c="#a8542a" position={[1.4, 2.8, -1.0]} />
      <Prop id="pizza" position={[-1.7, 1.1, 0.9]} scale={1.4} />
    </group>
  );
}

function Grill({ m }: { m: Machine }) {
  useSteam(m, 0, 2.2, 0.2, "#c8c8c8");
  return (
    <Stall w={4.4} d={3.2} wall="#7fb0c8" awning="#3f8fd9">
      <Part g={G.box(2.4, 0.2, 1.3)} c="#3a3f44" position={[0, 1.2, 0.25]} />
      {[-0.9, -0.45, 0, 0.45, 0.9].map((x) => (
        <Part key={x} g={G.box(0.05, 0.04, 1.2)} c="#8a8a8a" position={[x, 1.32, 0.25]} />
      ))}
      <Prop id="smokedfish" position={[-0.4, 1.33, 0.3]} scale={1.2} />
      <Prop id="fishdish" position={[1.6, 1.1, 0.3]} scale={1.4} />
    </Stall>
  );
}

function Pastry({ m }: { m: Machine }) {
  void m;
  return (
    <Stall w={4.4} d={3.2} wall="#f2b6c8" awning="#ff8fb1">
      <Part g={G.box(1.5, 1.0, 0.9)} c="#e8ecef" position={[-1.0, 1.6, -0.5]} />
      <Part g={G.box(1.1, 0.6, 0.06)} c="#8fd3f5" m={windowMat} position={[-1.0, 1.62, -0.02]} />
      <Prop id="eclair" position={[0.6, 1.1, 0.3]} scale={1.8} />
      <Prop id="eclair" position={[1.4, 1.1, 0.5]} scale={1.8} rotation={[0, 0.6, 0]} />
    </Stall>
  );
}

function Honeycake({ m }: { m: Machine }) {
  void m;
  return (
    <Stall w={4.4} d={3.2} wall="#e8c060" awning="#f0a020">
      <Prop id="honey" position={[-1.3, 1.1, 0.2]} scale={1.6} />
      <Prop id="cake" position={[-0.2, 1.1, 0.2]} scale={1.4} />
      <Prop id="medovik" position={[1.2, 1.1, 0.2]} scale={1.7} />
    </Stall>
  );
}

function Tailor({ m }: { m: Machine }) {
  const wheel = useRef<Group>(null);
  useFrame((_, dt) => {
    if (wheel.current && m.working) wheel.current.rotation.z += dt * 12;
  });
  return (
    <Stall w={4.4} d={3.2} wall="#9a8fc8" awning="#6c5cc4">
      {/* Sewing machine */}
      <Part g={G.box(1.3, 0.16, 0.6)} c="#2f3640" position={[-1.0, 1.17, 0.3]} />
      <Part g={G.box(0.26, 0.6, 0.3)} c="#2f3640" position={[-0.5, 1.5, 0.3]} />
      <Part g={G.box(1.1, 0.22, 0.28)} c="#2f3640" position={[-1.0, 1.84, 0.3]} />
      <group ref={wheel} position={[-0.32, 1.72, 0.3]} userData={DYNAMIC}>
        <mesh geometry={G.box(0.5, 0.06, 0.05)}>
          <meshLambertMaterial color="#cfd8dc" flatShading />
        </mesh>
      </group>
      {/* Dummy with a coat */}
      <Part g={G.cyl(0.03, 0.03, 0.5, 5)} c="#8a5a33" position={[1.3, 1.34, 0.1]} />
      <Part g={G.cyl(0.32, 0.26, 0.85, 8)} c="#4a5a8a" position={[1.3, 1.9, 0.1]} />
      <Part g={G.sphere(0.13, 6, 5)} c="#f4efe2" position={[1.3, 2.42, 0.1]} />
    </Stall>
  );
}

function Packer({ m }: { m: Machine }) {
  const belt = useRef<Group>(null);
  useFrame((state) => {
    if (belt.current && m.working) belt.current.position.x = -0.8 + ((state.clock.elapsedTime * 0.7) % 1) * 1.6;
  });
  return (
    <Stall w={4.4} d={3.2} wall="#8fc8b0" awning="#35a37a">
      <Part g={G.box(3.2, 0.12, 0.9)} c="#3a3f44" position={[0, 1.15, 0.35]} />
      <group ref={belt} position={[-0.8, 1.21, 0.35]} userData={DYNAMIC}>
        <mesh geometry={itemGeometry("giftbox")} material={itemMat} />
      </group>
      <Prop id="giftbox" position={[1.6, 1.21, -0.3]} scale={1.4} />
    </Stall>
  );
}

export const CITY_KITCHEN_MODELS = {
  c_coffee: Coffee,
  c_sandwich: Sandwich,
  c_oven: Oven,
  c_grill: Grill,
  c_pastry: Pastry,
  c_honeycake: Honeycake,
  c_tailor: Tailor,
  c_packer: Packer,
} as const;
