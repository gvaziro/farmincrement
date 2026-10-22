"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MeshBasicMaterial, type Group } from "three";
import { easeOutBack } from "@/game/core/math";
import type { Actor, Worker } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { fx } from "./fx";
import { G, Part } from "./kit";
import { StaticBatch } from "./StaticBatch";

export interface Look {
  shirt: string;
  pants: string;
  hat: "straw" | "cap" | "hard" | "none" | "bow";
  hatColor: string;
  skin: string;
  hair?: string;
}

const LOOKS: Record<string, Look> = {
  player: { shirt: "#e0533d", pants: "#3b6fb6", hat: "straw", hatColor: "#f2c94c", skin: "#ffd2a6" },
  harvester: { shirt: "#58b947", pants: "#6b4f3a", hat: "cap", hatColor: "#3f9b2f", skin: "#f6c08f" },
  carrier: { shirt: "#ff9f1c", pants: "#4a5a6a", hat: "cap", hatColor: "#e2721b", skin: "#ffd9b5" },
  operator: { shirt: "#3fa7ff", pants: "#3a4a6a", hat: "hard", hatColor: "#ffd23f", skin: "#e8b48a" },
};

export const blobMat = new MeshBasicMaterial({ color: "#1d3b12", transparent: true, opacity: 0.22, depthWrite: false });

export function Characters({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const workers = useMemo(() => {
    void structure;
    return [...runtime.game.state.workers];
  }, [runtime, structure]);
  return (
    <group>
      <Character get={() => runtime.game.state.player} look={LOOKS.player} dust />
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
  );
}

function Hat({ look }: { look: Look }) {
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
