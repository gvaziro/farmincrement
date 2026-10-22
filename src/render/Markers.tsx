"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { TUTORIAL_DONE, tutorialTarget } from "@/game/engine/tutorial";
import type { Runtime } from "@/runtime/runtime";
import { Arrow3D } from "./shapes";

/** Bouncing arrow over the current objective + a ground pointer around the player. */
export function Markers({ runtime }: { runtime: Runtime }) {
  const arrow = useRef<Group>(null);
  const pointer = useRef<Group>(null);

  useFrame((state) => {
    const g = runtime.game;
    const st = g.state;
    const t = state.clock.elapsedTime;
    let target: { x: number; z: number } | null = null;
    if (st.tutorial < TUTORIAL_DONE) target = tutorialTarget(g);
    else {
      const goal = g.goal();
      const cost = goal ? g.padCost(goal) : null;
      if (goal && cost !== null && st.money >= cost - goal.paid) target = { x: goal.def.x, z: goal.def.z };
    }

    const a = arrow.current!;
    const p = pointer.current!;
    if (!target) {
      a.visible = false;
      p.visible = false;
      return;
    }
    a.visible = true;
    const bounce = Math.abs(Math.sin(t * 3.4));
    a.position.set(target.x, 2.3 + bounce * 0.75, target.z);
    a.rotation.y = t * 1.6;
    const squash = 1 + (1 - bounce) * 0.12;
    a.scale.set(1.1 * squash, 1.1 / squash, 1.1 * squash);

    const pl = st.player;
    const dx = target.x - pl.x;
    const dz = target.z - pl.z;
    const d = Math.hypot(dx, dz);
    p.visible = d > 5;
    if (p.visible) {
      const ang = Math.atan2(dx, dz);
      const r = 1.35 + Math.sin(t * 6) * 0.1;
      p.position.set(pl.x + Math.sin(ang) * r, 0.12, pl.z + Math.cos(ang) * r);
      p.rotation.set(0, ang, 0);
    }
  });

  return (
    <group>
      <group ref={arrow}>
        <Arrow3D />
      </group>
      <group ref={pointer}>
        <group rotation-x={-Math.PI / 2} scale={0.55}>
          <Arrow3D />
        </group>
      </group>
    </group>
  );
}
