"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { dampAngle, mulberry32 } from "@/game/core/math";
import { MARKET } from "@/game/data/layout";
import { TUTORIAL_PADS_STEP } from "@/game/engine/tutorial";
import type { Actor } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { Character, type Look } from "./Characters";
import { G, Part } from "./kit";

/** Where shoppers stand around the stall, and which way they face. */
const SPOTS = [
  { x: MARKET.x - MARKET.w / 2 - 0.45, z: MARKET.sell.z - 0.75, face: Math.PI * 0.85 },
  { x: MARKET.x + MARKET.w / 2 + 0.45, z: MARKET.sell.z - 0.75, face: -Math.PI * 0.85 },
  { x: MARKET.x - MARKET.w / 2 - 0.65, z: MARKET.z - 0.3, face: Math.PI / 2 },
];

const SHIRTS = ["#ff8fb1", "#8e7cf0", "#4fc3c8", "#ffb238", "#a3d977", "#f06f5a"];
const HAIR = ["#6b3e1f", "#2b2b2b", "#d9a441", "#a8542a"];

type Phase = "hidden" | "in" | "go" | "shop" | "leave" | "out";

interface Npc {
  actor: Actor;
  look: Look;
  phase: Phase;
  t: number;
  spot: number;
  tx: number;
  tz: number;
  scale: number;
  bag: boolean;
}

function makeNpc(i: number): Npc {
  const rnd = mulberry32(900 + i * 17);
  const hats: Look["hat"][] = ["none", "bow", "cap", "none"];
  const hat = hats[Math.floor(rnd() * hats.length)];
  return {
    actor: {
      id: `npc_${i}`,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      facing: 0,
      stack: [],
      incoming: 0,
      capacity: 0,
      speed: 1.7,
      moving: false,
      walk: 0,
      zoneId: null,
      zoneTime: 0,
      transferCd: 0,
      lean: { x: 0, z: 0, vx: 0, vz: 0 },
      fullT: 0,
    },
    look: {
      shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
      pants: rnd() < 0.5 ? "#4a5a8a" : "#7a5a3a",
      hat,
      hatColor: hat === "bow" ? "#ff5d8f" : ["#5a8fd9", "#b06cff", "#ff7a59"][Math.floor(rnd() * 3)],
      skin: ["#ffd2a6", "#f2b98a", "#d99a6c", "#ffe0c2"][Math.floor(rnd() * 4)],
      hair: HAIR[Math.floor(rnd() * HAIR.length)],
    },
    phase: "hidden",
    t: 1 + i * 2.5,
    spot: -1,
    tx: 0,
    tz: 0,
    scale: 0,
    bag: false,
  };
}

/** A point just inside the farm's south/east edge where shoppers come and go. */
function edgePoint() {
  if (Math.random() < 0.5) return { x: 12.2, z: 3 + Math.random() * 7 };
  return { x: 3 + Math.random() * 8.5, z: 10.4 };
}

const COUNT = 3;

/** Ambient villagers who visit the market — pure decoration. */
export function Customers({ runtime }: { runtime: Runtime }) {
  const npcs = useMemo(() => Array.from({ length: COUNT }, (_, i) => makeNpc(i)), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = runtime.game.state;
    const allowed = st.tutorial >= TUTORIAL_PADS_STEP ? Math.min(COUNT, 1 + Math.floor(st.stats.sold / 60)) : 0;
    npcs.forEach((n, i) => {
      const a = n.actor;
      const moveTo = (x: number, z: number) => {
        const dx = x - a.x;
        const dz = z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.08) {
          a.vx = 0;
          a.vz = 0;
          a.moving = false;
          return true;
        }
        const step = Math.min(d, a.speed * dt);
        a.vx = (dx / d) * a.speed;
        a.vz = (dz / d) * a.speed;
        a.x += (dx / d) * step;
        a.z += (dz / d) * step;
        a.walk += step * 2.3;
        a.moving = true;
        a.facing = dampAngle(a.facing, Math.atan2(dx, dz), 10, dt);
        return false;
      };
      switch (n.phase) {
        case "hidden": {
          n.t -= dt;
          if (n.t > 0 || i >= allowed) return;
          const taken = new Set(npcs.filter((o) => o !== n && o.phase !== "hidden").map((o) => o.spot));
          const free = SPOTS.map((_, k) => k).filter((k) => !taken.has(k));
          if (free.length === 0) {
            n.t = 2;
            return;
          }
          n.spot = free[Math.floor(Math.random() * free.length)];
          const p = edgePoint();
          a.x = p.x;
          a.z = p.z;
          n.bag = false;
          n.phase = "in";
          n.scale = 0;
          return;
        }
        case "in":
          n.scale = Math.min(1, n.scale + dt * 3);
          if (n.scale >= 1) n.phase = "go";
          return;
        case "go":
          if (moveTo(SPOTS[n.spot].x, SPOTS[n.spot].z)) {
            n.phase = "shop";
            n.t = 2 + Math.random() * 3;
          }
          return;
        case "shop":
          a.facing = dampAngle(a.facing, SPOTS[n.spot].face, 6, dt);
          n.t -= dt;
          if (n.t <= 0) {
            n.bag = true;
            const p = edgePoint();
            n.tx = p.x;
            n.tz = p.z;
            n.phase = "leave";
          }
          return;
        case "leave":
          if (moveTo(n.tx, n.tz)) n.phase = "out";
          return;
        case "out":
          n.scale = Math.max(0, n.scale - dt * 3);
          if (n.scale <= 0) {
            n.phase = "hidden";
            n.spot = -1;
            n.t = 3 + Math.random() * 6;
          }
          return;
      }
    });
  });

  return (
    <group>
      {npcs.map((n) => (
        <Character key={n.actor.id} get={() => n.actor} look={n.look} scaleOf={() => n.scale} hand={<Bag npc={n} />} />
      ))}
    </group>
  );
}

function Bag({ npc }: { npc: Npc }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = npc.bag;
  });
  return (
    <group ref={ref}>
      <Part g={G.box(0.24, 0.26, 0.14)} c="#d9a86a" position={[0, -0.08, 0.05]} />
      <Part g={G.box(0.2, 0.06, 0.15)} c="#7cc24f" position={[0, 0.07, 0.05]} />
      <Part g={G.sphere(0.05, 5, 4)} c="#e8413c" position={[0.05, 0.1, 0.05]} />
    </group>
  );
}
