"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { roman } from "@/game/core/format";
import { easeOutBack } from "@/game/core/math";
import { ITEMS } from "@/game/data/items";
import { DEPOT, FARMHOUSE, MARKET, STATUE, TRASH } from "@/game/data/layout";
import { inputRect } from "@/game/engine/anchors";
import { TRUCK_FAR_X } from "@/game/engine/systems/depot";
import type { Machine, Truck } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { fx } from "../fx";
import { G, Part, mat } from "../kit";
import { MACHINE_MODELS } from "./machines";
import { OrderBoard } from "./OrderBoard";
import { Decal, Pallet, Sign } from "./parts";
import { windowMat } from "../nightMaterials";
import { Plaza } from "../shapes";
import { DYNAMIC, StaticBatch } from "../StaticBatch";

export function Buildings({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const st = runtime.game.state;
  const machines = useMemo(() => {
    void structure;
    return [...runtime.game.state.machines];
  }, [runtime, structure]);
  void structure;
  return (
    <group>
      {machines.map((m) => (
        <MachineView key={m.id} m={m} />
      ))}
      <Market runtime={runtime} />
      <Farmhouse />
      <FamilySign />
      <TrashBin />
      {st.depot && <Depot runtime={runtime} />}
      {st.statue && <Statue />}
    </group>
  );
}

function MachineView({ m }: { m: Machine }) {
  const body = useRef<Group>(null);
  const Model = MACHINE_MODELS[m.type.id];
  useFrame(() => {
    const g = body.current;
    if (!g) return;
    const k = m.spawnT < 0.8 ? Math.max(0.001, easeOutBack(Math.min(1, m.spawnT / 0.8), 2.2)) : 1;
    // Squash when an item arrives or a product pops out.
    const squash = m.pulse * 0.05;
    g.scale.set(k * (1 + squash), k * (1 - squash), k * (1 + squash));
  });
  const multi = m.type.inputs.length > 1;
  const lot = useMemo(() => {
    const t = m.type;
    const [w, d] = t.size;
    const penned = t.id === "coop" || t.id === "barn" || t.id === "sheepfold";
    const minX = Math.min(-w / 2, t.inZone[0] - t.inZone[2] / 2) - 0.45;
    const maxX = Math.max(w / 2, t.outZone[0] + t.outZone[2] / 2) + 0.45;
    const minZ = penned ? d / 2 - 0.1 : -d / 2 - 0.45;
    const maxZ = Math.max(t.inZone[1] + t.inZone[3] / 2, t.outZone[1] + t.outZone[3] / 2) + 0.45;
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ };
  }, [m.type]);
  return (
    <group position={[m.def.x, 0, m.def.z]}>
      <group ref={body}>
        <StaticBatch>
          <Model m={m} />
        </StaticBatch>
      </group>
      <StaticBatch>
        <Plaza x={lot.x} z={lot.z} w={lot.w} d={lot.d} />
        {/* input pallet(s) */}
        {m.type.inputs.map((inp) => {
          const r = inputRect(m, inp.item);
          return (
            <group key={inp.item} position={[r.x - m.def.x, 0, r.z - m.def.z]}>
              <Pallet w={r.hw * 2 - 0.1} d={r.hd * 2 - 0.1} />
              <Decal w={r.hw * 2} d={r.hd * 2} spec={{ icon: ITEMS[inp.item].icon, item: inp.item, arrow: multi ? undefined : "in", bg: "rgba(63,167,255,0.25)" }} y={0.07} opacity={0.85} />
            </group>
          );
        })}
        <group position={[m.outRect.x - m.def.x, 0, m.outRect.z - m.def.z]}>
          <Pallet w={m.outRect.hw * 2 - 0.1} d={m.outRect.hd * 2 - 0.1} />
          <Decal w={m.outRect.hw * 2} d={m.outRect.hd * 2} spec={{ icon: ITEMS[m.type.output.item].icon, item: m.type.output.item, arrow: "out", bg: "rgba(53,199,89,0.25)" }} y={0.07} opacity={0.85} />
        </group>
      </StaticBatch>
    </group>
  );
}

// ── market ──────────────────────────────────────────────────────────────
function Market({ runtime }: { runtime: Runtime }) {
  const stripes = 8;
  const w = MARKET.w;
  return (
    <StaticBatch>
      <Plaza x={MARKET.x} z={(MARKET.z - MARKET.d / 2 + MARKET.sell.z + MARKET.sell.d / 2) / 2} w={MARKET.w + 2.2} d={MARKET.sell.z + MARKET.sell.d / 2 - (MARKET.z - MARKET.d / 2) + 1.4} color="#e8d9b0" rim="#cbb27a" />
      <group position={[MARKET.x, 0, MARKET.z]}>
        <Part g={G.box(w, 0.95, 1.1)} c="#c98b52" position={[0, 0.475, 0.55]} />
        <Part g={G.box(w + 0.1, 0.1, 1.25)} c="#e0a96d" position={[0, 1.0, 0.55]} />
        <Part g={G.box(w, 1.5, 0.5)} c="#b57a45" position={[0, 0.75, -0.95]} />
        <Part g={G.box(w, 0.08, 0.6)} c="#e0a96d" position={[0, 1.15, -0.95]} />
        {[
          [-w / 2 + 0.1, 1.25],
          [w / 2 - 0.1, 1.25],
          [-w / 2 + 0.1, -1.2],
          [w / 2 - 0.1, -1.2],
        ].map(([x, z], i) => (
          <Part key={i} g={G.box(0.14, 2.6, 0.14)} c="#8a5a33" position={[x, 1.3, z]} />
        ))}
        {Array.from({ length: stripes }, (_, i) => (
          <Part
            key={i}
            g={G.box(w / stripes + 0.01, 0.08, 2.5)}
            c={i % 2 ? "#ffffff" : "#e8413c"}
            position={[-w / 2 + (w / stripes) * (i + 0.5), 2.75, 0.1]}
            rotation={[0.2, 0, 0]}
          />
        ))}
        {Array.from({ length: stripes }, (_, i) => (
          <Part key={`f${i}`} g={G.cone(w / stripes / 2 + 0.02, 0.28, 3)} c={i % 2 ? "#ffffff" : "#e8413c"} position={[-w / 2 + (w / stripes) * (i + 0.5), 2.4, 1.33]} rotation={[Math.PI, 0, 0]} />
        ))}
        {/* order board on two posts above the awning */}
        <Part g={G.box(0.1, 1.9, 0.1)} c="#8a5a33" position={[-1.5, 3.2, -0.15]} />
        <Part g={G.box(0.1, 1.9, 0.1)} c="#8a5a33" position={[1.5, 3.2, -0.15]} />
        <group position={[0, 3.98, 0]} rotation={[-0.32, 0, 0]} userData={DYNAMIC}>
          <OrderBoard runtime={runtime} />
        </group>
        {/* produce crates on the counter */}
        {[
          [-1.5, "#e8413c"],
          [-0.5, "#ffd23f"],
          [0.5, "#ff9f1c"],
          [1.5, "#8fd14f"],
        ].map(([x, c]) => (
          <group key={x as number} position={[x as number, 1.05, 0.55]}>
            <Part g={G.box(0.7, 0.25, 0.6)} c="#a8642a" position={[0, 0.12, 0]} />
            {[-0.18, 0, 0.18].map((dx) => (
              <Part key={dx} g={G.sphere(0.1, 6, 4)} c={c as string} position={[dx, 0.3, 0.05 * Math.sign(dx)]} />
            ))}
          </group>
        ))}
      </group>
      <group position={[MARKET.sell.x, 0, MARKET.sell.z]}>
        <Decal w={MARKET.sell.w} d={MARKET.sell.d} spec={{ icon: "💰", text: "ПРОДАЖА", bg: "rgba(255,204,51,0.35)", color: "#fff1a8" }} y={0.06} />
      </group>
    </StaticBatch>
  );
}

// ── farmhouse ───────────────────────────────────────────────────────────
/** Compost box: drop goods you do not want. */
function TrashBin() {
  const bz = TRASH.z - TRASH.d / 2 - 0.45;
  return (
    <StaticBatch>
      <group position={[TRASH.x, 0, bz]}>
        <Part g={G.box(1.3, 0.75, 0.8)} c="#7a5a3a" position={[0, 0.375, 0]} />
        {[-0.45, -0.15, 0.15, 0.45].map((x) => (
          <Part key={x} g={G.box(0.06, 0.78, 0.84)} c="#5f4329" position={[x, 0.39, 0]} />
        ))}
        <Part g={G.box(1.2, 0.1, 0.7)} c="#5a3a1f" position={[0, 0.72, 0]} />
        <Part g={G.ico(0.18, 0)} c="#6cbf4e" position={[-0.25, 0.82, 0.05]} />
        <Part g={G.ico(0.14, 0)} c="#e8413c" position={[0.2, 0.8, -0.05]} />
        <Part g={G.ico(0.12, 0)} c="#f2c94c" position={[0.05, 0.84, 0.15]} />
      </group>
      <group position={[TRASH.x, 0, TRASH.z]}>
        <Decal w={TRASH.w} d={TRASH.d} spec={{ icon: "🗑️", text: "ВЫБРОСИТЬ", bg: "rgba(120,90,60,0.35)", color: "#f0e0c8" }} y={0.06} />
      </group>
    </StaticBatch>
  );
}

/** Above the farmhouse door: which generation of the family farms here. */
function FamilySign() {
  const generation = useUI((s) => s.generation);
  if (generation < 1) return null;
  return (
    <group position={[FARMHOUSE.x, 1.94, FARMHOUSE.z + 1.56]}>
      <Sign text={`ПОКОЛЕНИЕ ${roman(generation + 1)}`} w={1.25} h={0.3} color="#6b4a2a" textColor="#ffe9a8" />
    </group>
  );
}

function Farmhouse() {
  return (
    <StaticBatch>
      <Plaza x={FARMHOUSE.x} z={FARMHOUSE.z + 0.9} w={FARMHOUSE.w + 1.4} d={FARMHOUSE.d + 3.6} color="#e3d2a6" rim="#c9b07a" />
      <group position={[FARMHOUSE.x, 0, FARMHOUSE.z]}>
        <Part g={G.box(4.2, 0.3, 3.3)} c="#c9a477" position={[0, 0.15, 0]} />
        <Part g={G.box(4.0, 2.0, 3.0)} c="#f5e6c8" position={[0, 1.3, 0]} />
        {/* beams on the corners */}
        {[-1.98, 1.98].map((x) => (
          <Part key={x} g={G.box(0.14, 2.0, 0.14)} c="#b07a45" position={[x, 1.3, 1.48]} />
        ))}
        <Part g={G.box(4.1, 0.14, 0.1)} c="#b07a45" position={[0, 2.25, 1.5]} />
        <Part g={G.prism(4.6, 1.7, 3.5)} c="#4a90d9" position={[0, 2.3, 0]} />
        <Part g={G.prism(3.9, 1.42, 0.04)} c="#f5e6c8" position={[0, 2.33, 1.77]} />
        {/* round attic window in the gable */}
        <Part g={G.cyl(0.32, 0.32, 0.06, 10)} c="#ffffff" position={[0, 2.85, 1.8]} rotation={[Math.PI / 2, 0, 0]} />
        <Part g={G.cyl(0.24, 0.24, 0.08, 10)} c="#8fd3f5" m={windowMat} position={[0, 2.85, 1.81]} rotation={[Math.PI / 2, 0, 0]} />
        <Part g={G.box(0.5, 1.6, 0.5)} c="#b35a3a" position={[1.25, 3.3, -0.5]} />
        <Part g={G.box(0.62, 0.14, 0.62)} c="#8f4530" position={[1.25, 4.12, -0.5]} />
        <Part g={G.box(0.82, 1.32, 0.1)} c="#ffffff" position={[0, 0.96, 1.52]} />
        <Part g={G.box(0.68, 1.2, 0.12)} c="#8a5a33" position={[0, 0.92, 1.53]} />
        <Part g={G.sphere(0.05, 5, 4)} c="#ffd23f" position={[0.22, 0.92, 1.62]} />
        {[-1.3, 1.3].map((x) => (
          <group key={x} position={[x, 1.35, 1.52]}>
            <Part g={G.box(0.8, 0.7, 0.06)} c="#ffffff" />
            <Part g={G.box(0.68, 0.58, 0.08)} c="#8fd3f5" m={windowMat} />
            <Part g={G.box(0.05, 0.58, 0.09)} c="#ffffff" />
            <Part g={G.box(0.25, 0.75, 0.07)} c="#5fae45" position={[-0.55, 0, 0]} />
            <Part g={G.box(0.25, 0.75, 0.07)} c="#5fae45" position={[0.55, 0, 0]} />
            <Part g={G.box(0.85, 0.18, 0.25)} c="#a8642a" position={[0, -0.45, 0.1]} />
            {[-0.25, 0, 0.25].map((dx, i) => (
              <Part key={dx} g={G.sphere(0.08, 5, 4)} c={["#ff6b8a", "#ffd23f", "#b98cff"][i]} position={[dx, -0.3, 0.15]} />
            ))}
          </group>
        ))}
        <Part g={G.box(1.3, 0.12, 0.7)} c="#c98b52" position={[0, 0.36, 1.85]} />
        {/* mailbox */}
        <Part g={G.box(0.08, 0.9, 0.08)} c="#8a5a33" position={[2.5, 0.45, 2.1]} />
        <Part g={G.box(0.3, 0.24, 0.45)} c="#e85d4a" position={[2.5, 1.0, 2.1]} />
      </group>
      <group position={[FARMHOUSE.door.x, 0, FARMHOUSE.door.z]}>
        <Decal w={FARMHOUSE.door.w} d={FARMHOUSE.door.d} spec={{ icon: "⬆️", text: "УЛУЧШЕНИЯ", bg: "rgba(176,108,255,0.35)", color: "#f0dcff" }} y={0.06} />
      </group>
    </StaticBatch>
  );
}

// ── depot, road, trucks ─────────────────────────────────────────────────
function Depot({ runtime }: { runtime: Runtime }) {
  const roadLen = 70 - 14;
  const roadX = 14 + roadLen / 2;
  const trucks = runtime.game.state.depot?.trucks ?? [];
  return (
    <StaticBatch>
      <Plaza x={DEPOT.x} z={DEPOT.z + 1.6} w={DEPOT.w + 1.6} d={DEPOT.d + 4.4} color="#c9ced2" rim="#a9b0b6" />
      <group position={[DEPOT.x, 0, DEPOT.z]}>
        <Part g={G.box(DEPOT.w, 3.0, DEPOT.d)} c="#a9bfcc" position={[0, 1.5, 0]} />
        {Array.from({ length: 9 }, (_, i) => (
          <Part key={i} g={G.box(0.06, 2.9, DEPOT.d + 0.04)} c="#93aab8" position={[-DEPOT.w / 2 + 0.35 + i * 0.66, 1.5, 0]} />
        ))}
        <Part g={G.prism(DEPOT.w + 0.4, 0.9, DEPOT.d + 0.4)} c="#5d7a8c" position={[0, 3.0, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Part g={G.box(2.6, 2.1, 0.1)} c="#e3e9ec" position={[-0.6, 1.1, DEPOT.d / 2 + 0.02]} />
        {Array.from({ length: 7 }, (_, i) => (
          <Part key={`d${i}`} g={G.box(2.6, 0.04, 0.12)} c="#c5ced3" position={[-0.6, 0.3 + i * 0.28, DEPOT.d / 2 + 0.05]} />
        ))}
        <group position={[1.9, 2.45, DEPOT.d / 2 + 0.06]}>
          <Sign text="СКЛАД" w={1.8} h={0.5} color="#3a5566" />
        </group>
        <Part g={G.box(DEPOT.w, 0.35, 1.2)} c="#9a9a9a" position={[0, 0.17, DEPOT.d / 2 + 0.6]} />
      </group>
      <group position={[DEPOT.input.x, 0, DEPOT.input.z]}>
        <Decal w={DEPOT.input.w} d={DEPOT.input.d} spec={{ icon: "📦", text: "НА ОТПРАВКУ ×1.5", bg: "rgba(63,167,255,0.3)" }} y={0.06} />
      </group>
      {/* road */}
      <mesh rotation-x={-Math.PI / 2} position={[roadX, 0.03, DEPOT.roadZ]} receiveShadow material={mat("#7d8590")}>
        <planeGeometry args={[roadLen, 3.0]} />
      </mesh>
      {Array.from({ length: Math.floor(roadLen / 2.4) }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[14.8 + i * 2.4, 0.04, DEPOT.roadZ]} material={mat("#f2f2f2")}>
          <planeGeometry args={[1.2, 0.14]} />
        </mesh>
      ))}
      {trucks.map((t, i) => (
        <TruckView key={t.id} runtime={runtime} truck={t} index={i} />
      ))}
    </StaticBatch>
  );
}

function TruckView({ runtime, truck, index }: { runtime: Runtime; truck: Truck; index: number }) {
  const g = useRef<Group>(null);
  const wheels = useRef<Group[]>([]);
  const lastX = useRef(truck.x);
  const smokeT = useRef(0);
  const colors = ["#e85d4a", "#3fa7ff", "#ffb238"];
  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const t = runtime.game.state.depot?.trucks[index] ?? truck;
    grp.visible = t.x < TRUCK_FAR_X - 0.5;
    grp.position.set(t.x, 0, t.z);
    const dx = t.x - lastX.current;
    lastX.current = t.x;
    for (const w of wheels.current) if (w) w.rotation.z -= dx / 0.38;
    grp.position.y = Math.abs(dx) > 0.001 ? Math.abs(Math.sin(t.x * 3)) * 0.03 : 0;
    if (Math.abs(dx) > 0.001) {
      smokeT.current += dt;
      if (smokeT.current > 0.12) {
        smokeT.current = 0;
        fx.smoke(t.x + 2.3, 0.4, t.z + 0.5, "#cfcfcf", 0.18);
      }
    }
  });
  const c = colors[index % colors.length];
  return (
    <group ref={g} userData={DYNAMIC}>
      <StaticBatch>
      {/* cab faces −x */}
      <Part g={G.box(1.5, 1.3, 1.7)} c={c} position={[-0.85, 1.0, 0]} />
      <Part g={G.box(0.06, 0.55, 1.4)} c="#bfe8ff" position={[-1.61, 1.25, 0]} />
      <Part g={G.box(1.2, 0.06, 1.72)} c="#ffffff" position={[-0.85, 1.67, 0]} />
      <Part g={G.box(0.3, 0.2, 0.3)} c="#fff7b0" position={[-1.6, 0.7, 0.6]} />
      <Part g={G.box(0.3, 0.2, 0.3)} c="#fff7b0" position={[-1.6, 0.7, -0.6]} />
      {/* bed */}
      <Part g={G.box(2.3, 0.25, 1.8)} c="#8a5a33" position={[1.15, 0.65, 0]} />
      <Part g={G.box(2.3, 0.35, 0.08)} c="#c98b52" position={[1.15, 0.95, 0.88]} />
      <Part g={G.box(2.3, 0.35, 0.08)} c="#c98b52" position={[1.15, 0.95, -0.88]} />
      <Part g={G.box(0.08, 0.35, 1.8)} c="#c98b52" position={[2.28, 0.95, 0]} />
      {[
        [-1.05, 0.9],
        [-1.05, -0.9],
        [0.75, 0.9],
        [0.75, -0.9],
        [1.75, 0.9],
        [1.75, -0.9],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.38, z]} userData={DYNAMIC} ref={(w) => void (w && (wheels.current[i] = w))}>
          <Part g={G.cyl(0.38, 0.38, 0.28, 10)} c="#2b2b2b" rotation={[Math.PI / 2, 0, 0]} />
          <Part g={G.cyl(0.18, 0.18, 0.3, 6)} c="#cfd8dc" rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      </StaticBatch>
    </group>
  );
}

// ── statue (finale) ─────────────────────────────────────────────────────
function Statue() {
  const g = useRef<Group>(null);
  const sparkle = useRef(0);
  useFrame((state, dt) => {
    if (g.current) g.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
    sparkle.current += dt;
    if (sparkle.current > 0.3) {
      sparkle.current = 0;
      fx.burst(STATUE.x + (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, STATUE.z + (Math.random() - 0.5) * 1.5, "#fff1a8", 2, 1.2, 0.06);
    }
  });
  const gold = "#ffcc33";
  return (
    <StaticBatch position={[STATUE.x, 0, STATUE.z]}>
      <Part g={G.box(2.8, 0.5, 2.8)} c="#c9c3b5" position={[0, 0.25, 0]} />
      <Part g={G.box(2.2, 1.0, 2.2)} c="#ddd7c9" position={[0, 1.0, 0]} />
      <group ref={g} userData={DYNAMIC} position={[0, 1.5, 0]} scale={1.6}>
        <StaticBatch>
        <Part g={G.box(0.16, 0.36, 0.17)} c={gold} position={[-0.1, 0.18, 0]} />
        <Part g={G.box(0.16, 0.36, 0.17)} c={gold} position={[0.1, 0.18, 0]} />
        <Part g={G.cyl(0.21, 0.24, 0.44, 8)} c={gold} position={[0, 0.58, 0]} />
        <Part g={G.box(0.11, 0.4, 0.11)} c={gold} position={[-0.3, 0.95, 0]} rotation={[0, 0, 0.5]} />
        <Part g={G.box(0.11, 0.34, 0.11)} c={gold} position={[0.28, 0.6, 0]} rotation={[0, 0, -0.15]} />
        <Part g={G.sphere(0.22, 10, 8)} c={gold} position={[0, 1.02, 0]} />
        <Part g={G.cyl(0.36, 0.36, 0.035, 12)} c={gold} position={[0, 1.2, 0]} />
        <Part g={G.cyl(0.17, 0.21, 0.17, 10)} c={gold} position={[0, 1.29, 0]} />
        <Part g={G.cyl(0.06, 0.06, 0.6, 6)} c={gold} position={[-0.45, 1.3, 0]} />
        <Part g={G.cone(0.14, 0.35, 6)} c={gold} position={[-0.45, 1.7, 0]} />
        </StaticBatch>
      </group>
    </StaticBatch>
  );
}
