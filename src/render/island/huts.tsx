"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MeshLambertMaterial, type Group } from "three";
import type { ItemId } from "@/game/data/items";
import type { Machine } from "@/game/engine/types";
import { fx } from "../fx";
import { G, Part } from "../kit";
import { itemGeometry } from "../models/itemModels";
import { DYNAMIC } from "../StaticBatch";

const itemMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

function Prop({ id, scale = 1, position, rotation }: { id: ItemId; scale?: number; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const g = useMemo(() => itemGeometry(id), [id]);
  return <mesh geometry={g} material={itemMat} scale={scale} position={position} rotation={rotation} castShadow />;
}

function useSmoke(m: Machine, x: number, y: number, z: number, color?: string) {
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!m.working && m.pulse < 0.2) return;
    t.current += dt;
    if (t.current > 0.3) {
      t.current = 0;
      fx.smoke(m.def.x + x, y, m.def.z + z, color);
    }
  });
}

/**
 * The island's hut: bamboo posts, woven walls and a thatched roof, with the
 * product hanging over the door as its sign.
 */
function Hut({ w, d, wall, product, accent = "#e8413c", tall = 1 }: { w: number; d: number; wall: string; product: ItemId; accent?: string; tall?: number }) {
  const h = 1.9 * tall;
  return (
    <group>
      <Part g={G.box(w + 0.2, 0.3, d + 0.2)} c="#b89a6a" position={[0, 0.15, 0]} />
      <Part g={G.box(w - 0.2, h, d - 0.2)} c={wall} position={[0, h / 2 + 0.3, 0]} />
      {[
        [-w / 2 + 0.1, -d / 2 + 0.1],
        [w / 2 - 0.1, -d / 2 + 0.1],
        [-w / 2 + 0.1, d / 2 - 0.1],
        [w / 2 - 0.1, d / 2 - 0.1],
      ].map(([x, z], i) => (
        <Part key={i} g={G.cyl(0.09, 0.1, h + 0.2, 6)} c="#c9a45a" position={[x, h / 2 + 0.3, z]} />
      ))}
      {/* Thatch: a big pyramid of straw with a darker rim. */}
      <Part g={G.cone(Math.max(w, d) * 0.82, 1.5 * tall, 4)} c="#d9b45a" position={[0, h + 1.05, 0]} rotation={[0, Math.PI / 4, 0]} />
      <Part g={G.cone(Math.max(w, d) * 0.86, 0.3, 4)} c="#b8923f" position={[0, h + 0.38, 0]} rotation={[0, Math.PI / 4, 0]} />
      <Part g={G.box(0.9, 1.25, 0.08)} c="#7a4b26" position={[0, 0.95, d / 2 - 0.08]} />
      <Part g={G.box(1.3, 0.12, 0.3)} c={accent} position={[0, 1.7, d / 2 + 0.02]} />
      <Prop id={product} position={[0, h + 0.25, d / 2 + 0.25]} scale={1.6} rotation={[0.3, 0, 0]} />
    </group>
  );
}

const hut = (product: ItemId, wall: string, accent: string, w = 3.6, d = 3.2) =>
  function IslandHut({ m }: { m: Machine }) {
    useSmoke(m, 0.9, 3.2, -0.4, "#e8e0c8");
    return <Hut w={w} d={d} wall={wall} product={product} accent={accent} />;
  };

/** A wide hut with an open-air bar counter in front. */
const bigHut = (product: ItemId, wall: string, accent: string) =>
  function IslandBar({ m }: { m: Machine }) {
    const sway = useRef<Group>(null);
    useFrame((state) => {
      if (sway.current) sway.current.rotation.z = m.working ? Math.sin(state.clock.elapsedTime * 6) * 0.08 : 0;
    });
    return (
      <group>
        <Hut w={4.6} d={3.6} wall={wall} product={product} accent={accent} tall={1.1} />
        <group ref={sway} position={[1.6, 2.4, 1.9]} userData={DYNAMIC}>
          <mesh geometry={G.sphere(0.18, 6, 5)}>
            <meshLambertMaterial color={accent} flatShading />
          </mesh>
        </group>
      </group>
    );
  };

function Juicer({ m }: { m: Machine }) {
  const press = useRef<Group>(null);
  useFrame((state) => {
    if (press.current) press.current.position.y = 2.0 + (m.working ? Math.abs(Math.sin(state.clock.elapsedTime * 8)) * 0.25 : 0);
  });
  return (
    <group>
      <Hut w={3.2} d={3.2} wall="#e8c98f" product="ajuice" accent="#ffd23f" />
      <group ref={press} position={[-1.7, 2.0, 0.6]} userData={DYNAMIC}>
        <mesh geometry={G.box(0.5, 0.2, 0.5)}>
          <meshLambertMaterial color="#8a5a33" flatShading />
        </mesh>
      </group>
    </group>
  );
}

function Dryer({ m }: { m: Machine }) {
  void m;
  return (
    <group>
      <Hut w={3.6} d={3.0} wall="#e0c070" product="chips" accent="#ffe14d" />
      {/* Drying racks with bananas. */}
      {[-1.2, 0, 1.2].map((x) => (
        <group key={x} position={[x, 0, -2.0]}>
          <Part g={G.box(0.9, 0.06, 0.5)} c="#8a5a33" position={[0, 0.9, 0]} />
          <Part g={G.box(0.06, 0.9, 0.06)} c="#8a5a33" position={[-0.4, 0.45, 0]} />
          <Part g={G.box(0.06, 0.9, 0.06)} c="#8a5a33" position={[0.4, 0.45, 0]} />
          <Part g={G.box(0.7, 0.04, 0.35)} c="#ffe14d" position={[0, 0.95, 0]} />
        </group>
      ))}
    </group>
  );
}

function Grill({ m }: { m: Machine }) {
  useSmoke(m, 1.2, 1.4, 1.2, "#bdbdbd");
  return (
    <group>
      <Hut w={3.6} d={3.2} wall="#d9a46a" product="grillfish" accent="#e85d4a" />
      <Part g={G.box(1.2, 0.7, 0.7)} c="#5a5a5a" position={[1.1, 0.35, 1.9]} />
      <Part g={G.box(1.1, 0.05, 0.6)} c="#ff6a00" position={[1.1, 0.72, 1.9]} />
    </group>
  );
}

function Sugarmill({ m }: { m: Machine }) {
  const wheel = useRef<Group>(null);
  useFrame((_, dt) => {
    if (wheel.current && m.working) wheel.current.rotation.z += dt * 3;
  });
  return (
    <group>
      <Hut w={3.6} d={3.2} wall="#e8d8a8" product="sugar" accent="#9fd06a" />
      <group ref={wheel} position={[-2.0, 1.5, 0.4]} userData={DYNAMIC}>
        <mesh geometry={G.torus(0.6, 0.08, 5, 12)} rotation={[0, Math.PI / 2, 0]}>
          <meshLambertMaterial color="#8a5a33" flatShading />
        </mesh>
      </group>
    </group>
  );
}

function PearlShop({ m }: { m: Machine }) {
  void m;
  return (
    <group>
      <Hut w={3.6} d={3.2} wall="#cfe0e8" product="pearl" accent="#8fd3f5" />
      <Part g={G.sphere(0.25, 8, 6)} c="#f4f0ff" position={[-1.4, 0.5, 1.9]} />
    </group>
  );
}

export const ISLAND_HUT_MODELS = {
  i_juicer: Juicer,
  i_icepop: hut("icepop", "#f2c6d6", "#ff8fb1", 3.6, 3.0),
  i_dryer: Dryer,
  i_press: hut("cmilk", "#e8dcc0", "#8a5a33"),
  i_smoothie: bigHut("smoothie", "#f2c6d6", "#ff5d8f"),
  i_grill: Grill,
  i_sugarmill: Sugarmill,
  i_candy: bigHut("candy", "#ffd0dc", "#ff6b8a"),
  i_cocoadryer: hut("cocoabeans", "#d9b48a", "#7a4a2a"),
  i_chocolate: bigHut("chocolate", "#c9a07a", "#5a3420"),
  i_roaster: hut("roasted", "#c9a07a", "#6b4226"),
  i_gelato: bigHut("gelato", "#f4ecd8", "#f0c040"),
  i_pearlshop: PearlShop,
  i_jeweler: hut("necklace", "#e0d8f0", "#b06cff"),
} as const;
