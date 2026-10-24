"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MeshBasicMaterial, MeshLambertMaterial, TorusGeometry, type Group } from "three";
import { easeOutBack } from "@/game/core/math";
import { HATS, type HatId } from "@/game/data/hats";
import type { Actor, Worker } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { fx } from "./fx";
import { merge, P, part } from "./geom";
import { G, Part, Plain } from "./kit";
import { seasonVisual } from "./seasonLook";
import { StaticBatch } from "./StaticBatch";

export interface Look {
  shirt: string;
  pants: string;
  hat: HatId | "hard" | "none" | "bow";
  hatColor: string;
  skin: string;
  hair?: string;
  /** Scarf worn in autumn and winter. */
  scarf?: string;
}

const LOOKS: Record<string, Look> = {
  player: { shirt: "#e0533d", pants: "#3b6fb6", hat: "straw", hatColor: "#f2c94c", skin: "#ffd2a6", scarf: "#3f8fd9" },
  harvester: { shirt: "#58b947", pants: "#6b4f3a", hat: "cap", hatColor: "#3f9b2f", skin: "#f6c08f", scarf: "#e8413c" },
  carrier: { shirt: "#ff9f1c", pants: "#4a5a6a", hat: "cap", hatColor: "#e2721b", skin: "#ffd9b5", scarf: "#4fae3a" },
  operator: { shirt: "#3fa7ff", pants: "#3a4a6a", hat: "hard", hatColor: "#ffd23f", skin: "#e8b48a", scarf: "#d9485f" },
};

/** Each generation of the family wears its own colour. */
const FAMILY_SHIRTS = ["#e0533d", "#3fa7a0", "#8e6cc9", "#f29e1c", "#4a90d9", "#d9485f", "#5fae45"];

const scarfMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const scarfGeos = new Map<string, ReturnType<typeof merge>>();
/** A knitted scarf round the neck with one end hanging down (one mesh). */
function scarfGeometry(color: string) {
  let g = scarfGeos.get(color);
  if (!g) {
    g = merge([
      part(new TorusGeometry(0.17, 0.065, 5, 12), color, { p: [0, 0.83, 0], r: [Math.PI / 2, 0, 0] }),
      part(P.box(0.1, 0.28, 0.05), color, { p: [0.09, 0.67, 0.19], r: [0.15, 0, -0.12] }),
      part(P.box(0.105, 0.04, 0.055), "#ffffff", { p: [0.075, 0.56, 0.205], r: [0.15, 0, -0.12] }),
    ]);
    scarfGeos.set(color, g);
  }
  return g;
}

export const blobMat = new MeshBasicMaterial({ color: "#1d3b12", transparent: true, opacity: 0.22, depthWrite: false });

/** Achievement hats (fixed palettes). Head top is at y ≈ 0.26. */
const FANCY_HATS = {
  cowboy: () => (
    <group position={[0, 0.17, 0]}>
      <Part g={G.cyl(0.4, 0.4, 0.03, 14)} c="#a0612f" />
      <Part g={G.box(0.12, 0.03, 0.5)} c="#a0612f" position={[-0.36, 0.05, 0]} rotation={[0, 0, 0.55]} />
      <Part g={G.box(0.12, 0.03, 0.5)} c="#a0612f" position={[0.36, 0.05, 0]} rotation={[0, 0, -0.55]} />
      <Part g={G.cyl(0.16, 0.2, 0.22, 10)} c="#a0612f" position={[0, 0.12, 0]} />
      <Part g={G.cyl(0.205, 0.205, 0.045, 10)} c="#5a3a1f" position={[0, 0.04, 0]} />
      <Part g={G.box(0.05, 0.04, 0.22)} c="#8a5228" position={[0, 0.235, 0]} />
    </group>
  ),
  chef: () => (
    <group position={[0, 0.15, 0]}>
      <Part g={G.cyl(0.22, 0.22, 0.14, 12)} c="#ffffff" position={[0, 0.06, 0]} />
      <Part g={G.sphere(0.25, 10, 8)} c="#ffffff" scale={[1, 0.75, 1]} position={[0, 0.25, 0]} />
      <Part g={G.sphere(0.13, 8, 6)} c="#f4f4f4" position={[-0.16, 0.24, 0.05]} />
      <Part g={G.sphere(0.13, 8, 6)} c="#f4f4f4" position={[0.16, 0.24, -0.05]} />
    </group>
  ),
  wreath: () => (
    <group position={[0, 0.17, 0]}>
      <Part g={G.torus(0.2, 0.045, 5, 14)} c="#4fae3a" rotation={[Math.PI / 2, 0, 0]} />
      {["#ff6b8a", "#ffd23f", "#ffffff", "#b98cff", "#ff9f1c", "#ff6b8a"].map((c, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Part key={i} g={G.sphere(0.055, 6, 4)} c={c} position={[Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2]} />;
      })}
    </group>
  ),
  crown: () => (
    <group position={[0, 0.16, 0]}>
      <Part g={G.cyl(0.2, 0.2, 0.1, 10)} c="#ffcc33" position={[0, 0.03, 0]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        return <Part key={i} g={G.cone(0.055, 0.15, 5)} c="#ffcc33" position={[Math.cos(a) * 0.18, 0.15, Math.sin(a) * 0.18]} />;
      })}
      <Part g={G.sphere(0.035, 6, 4)} c="#e8413c" position={[0, 0.04, 0.2]} />
      <Part g={G.sphere(0.03, 6, 4)} c="#3fa7ff" position={[-0.12, 0.04, 0.16]} />
      <Part g={G.sphere(0.03, 6, 4)} c="#3fa7ff" position={[0.12, 0.04, 0.16]} />
    </group>
  ),
  tophat: () => (
    <group position={[0, 0.17, 0]}>
      <Part g={G.cyl(0.3, 0.3, 0.03, 14)} c="#2b2b2b" />
      <Part g={G.cyl(0.17, 0.17, 0.34, 12)} c="#2b2b2b" position={[0, 0.18, 0]} />
      <Part g={G.cyl(0.175, 0.175, 0.06, 12)} c="#d9485f" position={[0, 0.06, 0]} />
    </group>
  ),
  fisher: () => (
    <group position={[0, 0.13, 0]}>
      <Part g={G.cyl(0.2, 0.23, 0.15, 10)} c="#8a9a5b" position={[0, 0.09, 0]} />
      <Part g={G.cyl(0.25, 0.33, 0.05, 12)} c="#7a8a4b" position={[0, 0.01, 0]} />
      <Part g={G.sphere(0.04, 5, 4)} c="#e8413c" position={[0.2, 0.1, 0.08]} />
      <Part g={G.cone(0.03, 0.12, 4)} c="#ffd23f" position={[0.22, 0.17, 0.06]} rotation={[0, 0, -0.4]} />
    </group>
  ),
  pumpkin: () => (
    <group position={[0, 0.2, 0]}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <Part key={i} g={G.sphere(0.12, 8, 6)} c={i % 2 ? "#f28c28" : "#e07a1c"} position={[Math.cos(a) * 0.08, 0.07, Math.sin(a) * 0.08]} scale={[0.8, 0.85, 0.8]} />;
      })}
      <Part g={G.sphere(0.14, 8, 6)} c="#f59a35" scale={[1, 0.8, 1]} position={[0, 0.07, 0]} />
      <Part g={G.cyl(0.02, 0.03, 0.08, 5)} c="#5a7a2a" position={[0, 0.2, 0]} />
      <Part g={G.cone(0.06, 0.02, 5)} c="#4fae3a" position={[0.06, 0.2, 0]} rotation={[0, 0, -0.6]} />
    </group>
  ),
  explorer: () => (
    // Pith helmet: a khaki dome, a sloping brim and a band.
    <group position={[0, 0.13, 0]}>
      <Part g={G.sphere(0.235, 10, 7)} c="#d9c48f" scale={[1, 0.8, 1.08]} position={[0, 0.06, 0]} />
      <Part g={G.cyl(0.34, 0.37, 0.05, 14)} c="#cdb57c" position={[0, 0.0, 0]} rotation={[0.08, 0, 0]} />
      <Part g={G.cyl(0.238, 0.238, 0.055, 12)} c="#8a6a3a" position={[0, 0.06, 0]} />
      <Part g={G.sphere(0.04, 6, 4)} c="#e0d1a2" position={[0, 0.25, 0]} />
    </group>
  ),
  party: () => (
    <group position={[0, 0.2, 0.02]} rotation={[0.15, 0, 0.1]}>
      <Part g={G.cone(0.15, 0.36, 10)} c="#ff5d8f" position={[0, 0.18, 0]} />
      <Part g={G.cyl(0.115, 0.13, 0.04, 10)} c="#ffd23f" position={[0, 0.08, 0]} />
      <Part g={G.cyl(0.06, 0.075, 0.035, 10)} c="#3fa7ff" position={[0, 0.22, 0]} />
      <Part g={G.sphere(0.055, 6, 4)} c="#ffd23f" position={[0, 0.37, 0]} />
    </group>
  ),
} as const;

export function Characters({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const hat = useUI((s) => s.hat);
  const generation = useUI((s) => s.generation);
  const workers = useMemo(() => {
    void structure;
    return [...runtime.game.state.workers];
  }, [runtime, structure]);
  const player = useMemo<Look>(
    () => ({ ...LOOKS.player, shirt: FAMILY_SHIRTS[generation % FAMILY_SHIRTS.length], hat, hatColor: HATS[hat].color }),
    [hat, generation],
  );
  return (
    <group>
      {/* Keyed by look: the baked character mesh is rebuilt when it changes. */}
      <Character key={`player-${hat}-${generation}`} get={() => runtime.game.state.player} look={player} dust />
      {workers.map((w) => (
        <Character key={w.id} get={() => runtime.game.actor(w.id)} look={LOOKS[w.def.job.kind]} />
      ))}
    </group>
  );
}

interface CharacterProps {
  get: () => Actor | undefined;
  look: Look;
  /** Scale override (NPC fade in/out); defaults to worker spawn animation. */
  scaleOf?: () => number;
  dust?: boolean;
  /** Rendered in the right hand (e.g. a shopping bag). */
  hand?: React.ReactNode;
}

export function Character({ get, look, scaleOf, dust = false, hand }: CharacterProps) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const head = useRef<Group>(null);
  const dustT = useRef(0);
  const scarf = useRef<Group>(null);

  useFrame((state, dt) => {
    const a: Actor | undefined = get();
    const r = root.current;
    if (!a || !r) return;
    const t = state.clock.elapsedTime;
    r.position.set(a.x, 0, a.z);
    r.rotation.y = a.facing;

    const w = "phase" in a ? (a as Worker) : null;
    let sc = 1;
    if (scaleOf) sc = scaleOf();
    else if (w) {
      const spawn = Math.min(1, w.spawnT / 0.6);
      sc = spawn < 1 ? Math.max(0.01, easeOutBack(spawn)) : 1;
    }
    r.visible = sc > 0.005;
    r.scale.setScalar(Math.max(0.01, sc));

    const speed = Math.hypot(a.vx, a.vz);
    const moving = a.moving && speed > 0.3;
    const ph = a.walk * 2.2;
    const swing = moving ? Math.min(1, speed / 3) : 0;
    const carrying = a.stack.length > 0;
    const working = w?.phase === "operate";

    legL.current!.rotation.x = Math.sin(ph) * 0.75 * swing;
    legR.current!.rotation.x = -Math.sin(ph) * 0.75 * swing;
    if (working) {
      armL.current!.rotation.x = -1.2 + Math.sin(t * 9) * 0.35;
      armR.current!.rotation.x = -1.2 - Math.sin(t * 9) * 0.35;
    } else if (carrying) {
      // Hands on the straps, small counter-swing.
      armL.current!.rotation.x = -0.35 - Math.sin(ph) * 0.25 * swing;
      armR.current!.rotation.x = -0.35 + Math.sin(ph) * 0.25 * swing;
    } else {
      armL.current!.rotation.x = -Math.sin(ph) * 0.7 * swing + Math.sin(t * 2) * 0.04;
      armR.current!.rotation.x = Math.sin(ph) * 0.7 * swing - Math.sin(t * 2) * 0.04;
    }
    armL.current!.rotation.z = 0.12;
    armR.current!.rotation.z = -0.12;
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.07 : Math.sin(t * 2.4) * 0.012;
    body.current!.position.y = bob;
    body.current!.rotation.x = moving ? 0.1 * swing : 0;
    // Scarves come out when it gets cold.
    if (scarf.current) scarf.current.visible = seasonVisual.winter + seasonVisual.autumn >= 0.5;
    head.current!.rotation.z = moving ? Math.sin(ph) * 0.05 : Math.sin(t * 1.3) * 0.04;

    // Footstep dust for the player.
    if (dust && moving && speed > 3) {
      dustT.current += dt;
      if (dustT.current > 0.16) {
        dustT.current = 0;
        fx.dust(a.x - Math.sin(a.facing) * 0.2, a.z - Math.cos(a.facing) * 0.2);
      }
    }
  });

  const s = look;
  return (
    <Plain>
    <group ref={root}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -0.05]} material={blobMat}>
        <circleGeometry args={[0.42, 16]} />
      </mesh>
      {/* Every limb is one baked mesh: ~6 draw calls per character. */}
      <group ref={body}>
        <group ref={legL} position={[-0.1, 0.36, 0]}>
          <StaticBatch>
            <Part g={G.box(0.15, 0.3, 0.16)} c={s.pants} position={[0, -0.15, 0]} />
            <Part g={G.box(0.17, 0.08, 0.22)} c="#5a3a22" position={[0, -0.32, 0.03]} />
          </StaticBatch>
        </group>
        <group ref={legR} position={[0.1, 0.36, 0]}>
          <StaticBatch>
            <Part g={G.box(0.15, 0.3, 0.16)} c={s.pants} position={[0, -0.15, 0]} />
            <Part g={G.box(0.17, 0.08, 0.22)} c="#5a3a22" position={[0, -0.32, 0.03]} />
          </StaticBatch>
        </group>
        <StaticBatch>
          <Part g={G.cyl(0.21, 0.24, 0.44, 8)} c={s.shirt} position={[0, 0.58, 0]} />
          <Part g={G.box(0.3, 0.26, 0.06)} c={s.pants} position={[0, 0.5, 0.2]} />
          <Part g={G.cyl(0.245, 0.245, 0.12, 8)} c={s.pants} position={[0, 0.4, 0]} />
          {/* back carrier frame (only for those who haul stacks) */}
          {!hand && (
            <>
              <Part g={G.box(0.5, 0.05, 0.36)} c="#a8642a" position={[0, 0.63, -0.38]} />
              <Part g={G.box(0.05, 0.5, 0.05)} c="#8a5a2a" position={[-0.17, 0.62, -0.25]} rotation={[0.25, 0, 0]} />
              <Part g={G.box(0.05, 0.5, 0.05)} c="#8a5a2a" position={[0.17, 0.62, -0.25]} rotation={[0.25, 0, 0]} />
            </>
          )}
        </StaticBatch>
        {s.scarf && (
          <group ref={scarf} visible={false}>
            <mesh geometry={scarfGeometry(s.scarf)} material={scarfMat} castShadow />
          </group>
        )}
        <group ref={armL} position={[-0.27, 0.76, 0]}>
          <StaticBatch>
            <Part g={G.box(0.11, 0.32, 0.11)} c={s.shirt} position={[0, -0.15, 0]} />
            <Part g={G.sphere(0.07, 6, 5)} c={s.skin} position={[0, -0.33, 0]} />
          </StaticBatch>
        </group>
        <group ref={armR} position={[0.27, 0.76, 0]}>
          <StaticBatch>
            <Part g={G.box(0.11, 0.32, 0.11)} c={s.shirt} position={[0, -0.15, 0]} />
            <Part g={G.sphere(0.07, 6, 5)} c={s.skin} position={[0, -0.33, 0]} />
          </StaticBatch>
          {hand && <group position={[0, -0.42, 0.02]}>{hand}</group>}
        </group>
        <group ref={head} position={[0, 0.98, 0]}>
          <StaticBatch>
            <Part g={G.sphere(0.22, 10, 8)} c={s.skin} position={[0, 0.04, 0]} />
            <Part g={G.sphere(0.03, 5, 4)} c="#2b2b2b" position={[-0.075, 0.07, 0.195]} shadow={false} />
            <Part g={G.sphere(0.03, 5, 4)} c="#2b2b2b" position={[0.075, 0.07, 0.195]} shadow={false} />
            <Part g={G.sphere(0.035, 5, 4)} c="#ff9e8a" position={[-0.12, 0.0, 0.17]} shadow={false} />
            <Part g={G.sphere(0.035, 5, 4)} c="#ff9e8a" position={[0.12, 0.0, 0.17]} shadow={false} />
            <Part g={G.sphere(0.035, 5, 4)} c="#f0a77a" position={[0, 0.02, 0.22]} shadow={false} />
            <Hat look={s} />
          </StaticBatch>
        </group>
      </group>
    </group>
    </Plain>
  );
}

function Hat({ look }: { look: Look }) {
  const fancy = FANCY_HATS[look.hat as keyof typeof FANCY_HATS];
  if (fancy) return fancy();
  if (look.hat === "beanie") {
    // Knitted winter hat with a turned-up rim and a pompom.
    return (
      <group position={[0, 0.12, 0]}>
        <Part g={G.sphere(0.235, 10, 6)} c={look.hatColor} scale={[1, 0.82, 1]} position={[0, 0.03, 0]} />
        <Part g={G.cyl(0.24, 0.24, 0.08, 12)} c="#ffffff" position={[0, -0.02, 0]} />
        <Part g={G.sphere(0.08, 8, 6)} c="#ffffff" position={[0, 0.24, 0]} />
      </group>
    );
  }
  if (look.hat === "straw") {
    return (
      <group position={[0, 0.17, 0]}>
        <Part g={G.cyl(0.36, 0.36, 0.035, 12)} c={look.hatColor} />
        <Part g={G.cyl(0.17, 0.21, 0.17, 10)} c={look.hatColor} position={[0, 0.09, 0]} />
        <Part g={G.cyl(0.215, 0.215, 0.05, 10)} c="#e0533d" position={[0, 0.04, 0]} />
      </group>
    );
  }
  if (look.hat === "hard") {
    return (
      <group position={[0, 0.14, 0]}>
        <Part g={G.sphere(0.23, 10, 6)} c={look.hatColor} scale={[1, 0.7, 1]} position={[0, 0.03, 0]} />
        <Part g={G.cyl(0.29, 0.29, 0.03, 12)} c={look.hatColor} />
      </group>
    );
  }
  if (look.hat === "none" || look.hat === "bow") {
    // Hair cap (+ a bow).
    return (
      <group position={[0, 0.1, 0]}>
        <Part g={G.sphere(0.235, 10, 6)} c={look.hair ?? "#6b3e1f"} scale={[1, 0.7, 1.02]} position={[0, 0.02, -0.03]} />
        {look.hat === "bow" && (
          <>
            <Part g={G.cone(0.08, 0.14, 4)} c={look.hatColor} position={[-0.08, 0.17, -0.05]} rotation={[0, 0, Math.PI / 2]} />
            <Part g={G.cone(0.08, 0.14, 4)} c={look.hatColor} position={[0.08, 0.17, -0.05]} rotation={[0, 0, -Math.PI / 2]} />
            <Part g={G.sphere(0.04, 5, 4)} c={look.hatColor} position={[0, 0.17, -0.05]} />
          </>
        )}
      </group>
    );
  }
  return (
    <group position={[0, 0.13, 0]}>
      <Part g={G.sphere(0.225, 10, 6)} c={look.hatColor} scale={[1, 0.62, 1]} position={[0, 0.02, 0]} />
      <Part g={G.box(0.3, 0.03, 0.2)} c={look.hatColor} position={[0, -0.01, 0.2]} />
    </group>
  );
}
