"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, type BufferGeometry, type Group } from "three";
import { mulberry32 } from "@/game/core/math";
import { BRIDGE_HALF, HARBOR_BAY, ISLAND_BOUNDS, ISLAND_DEPOT, ISLAND_HOUSE, ISLAND_LAYOUT, ISLAND_MARKET, ISLAND_TRASH, ISLAND_ZONES, LAGOON, LIGHTHOUSE, PEARL_BAY, SEAPLANE_STOP, STRAIT } from "@/game/data/island";
import { ZONE_D, ZONE_W, type ZoneDef } from "@/game/data/layout";
import { nightLevel } from "../nightMaterials";
import { TRUCK_FAR_X } from "@/game/engine/systems/depot";
import type { Machine, Truck } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { MachineView } from "../buildings/Buildings";
import { OrderBoard } from "../buildings/OrderBoard";
import { Decal, Pallet, Sign } from "../buildings/parts";
import { fx } from "../fx";
import { merge, P, part } from "../geom";
import { G, Part, mat } from "../kit";
import { lanternMat, windowMat } from "../nightMaterials";
import { makeSeasonal } from "../seasonLook";
import { Plaza } from "../shapes";
import { DYNAMIC, StaticBatch } from "../StaticBatch";

const SAND = "#ecd9a6";
const LOCKED = new Color("#cdbb88");
const SEA = new Color("#2fb4c8");
const dummy = new Object3D();

/** The island world: sea, sand, jungle, huts. */
export function IslandWorld({ runtime }: { runtime: Runtime }) {
  return (
    <group>
      <Sea />
      {ISLAND_ZONES.map((z) => (
        <Isle key={z.id} runtime={runtime} zone={z} />
      ))}
      <Bridges runtime={runtime} />
      <Waters />
      <Palms />
      <IslandBuildings runtime={runtime} />
    </group>
  );
}

// ── water ───────────────────────────────────────────────────────────────
let seaMat: MeshLambertMaterial | null = null;
function Sea() {
  seaMat ??= new MeshLambertMaterial({ color: SEA.clone(), emissive: new Color("#0b4a5a") });
  const m = seaMat;
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    m.emissive.setRGB(0.04 + Math.sin(t * 0.7) * 0.01, 0.26 + Math.sin(t * 0.5) * 0.02, 0.32 + Math.sin(t * 0.6) * 0.02);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.12, -20]} receiveShadow material={m}>
      <planeGeometry args={[420, 420]} />
    </mesh>
  );
}

/** The lagoon and the bays sit on top of their plots. */
function Waters() {
  const water = useMemo(() => new MeshLambertMaterial({ color: "#3ec6dc", emissive: "#14607a" }), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    water.emissive.setRGB(0.06 + Math.sin(t * 0.8) * 0.012, 0.3 + Math.sin(t * 0.6) * 0.02, 0.4 + Math.sin(t * 0.7) * 0.02);
  });
  return (
    <group>
      {[LAGOON, HARBOR_BAY, PEARL_BAY].map((w, i) => (
        <group key={i}>
          <mesh rotation-x={-Math.PI / 2} position={[w.x, 0.03, w.z]} material={mat("#f4e6b8", { kind: "plain" })} receiveShadow>
            <planeGeometry args={[w.hw * 2 + 1.2, w.hd * 2 + 1.2]} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[w.x, 0.05, w.z]} material={water}>
            <planeGeometry args={[w.hw * 2, w.hd * 2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── islands ─────────────────────────────────────────────────────────────
const isleMats = new Map<string, MeshLambertMaterial>();
function isleMaterial(id: string) {
  let m = isleMats.get(id);
  if (!m) {
    m = makeSeasonal(new MeshLambertMaterial({ color: LOCKED.clone() }), "plain");
    isleMats.set(id, m);
  }
  return m;
}

/** One island: a sandy beach all round and its own grass once bought. */
function Isle({ runtime, zone }: { runtime: Runtime; zone: ZoneDef }) {
  const material = isleMaterial(zone.id);
  const target = useMemo(() => new Color(zone.tint), [zone.tint]);
  useFrame((_, dt) => {
    const open = runtime.game.state.zones.has(zone.id);
    material.color.lerp(open ? target : LOCKED, Math.min(1, dt * 2.5));
  });
  const cx = zone.gx * ZONE_W;
  const cz = zone.gz * ZONE_D;
  const w = ZONE_W - STRAIT;
  const d = ZONE_D - STRAIT;
  return (
    <group>
      <mesh position={[cx, -0.06, cz]} material={mat(SAND, { kind: "plain" })} receiveShadow>
        <boxGeometry args={[w, 0.12, d]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.005, cz]} material={material} receiveShadow>
        <planeGeometry args={[w - 2.2, d - 2.2]} />
      </mesh>
      <Jungle runtime={runtime} zone={zone} />
    </group>
  );
}

const palmGeo = () =>
  merge([
    ...Array.from({ length: 5 }, (_, i) => part(P.cyl(0.13 - i * 0.006, 0.15 - i * 0.006, 0.55, 6), i % 2 ? "#a8844a" : "#93733f", { p: [i * 0.06, 0.27 + i * 0.52, 0], r: [0, 0, -0.1] })),
    ...Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2;
      return part(P.box(0.32, 0.03, 1.7), i % 2 ? "#4fae3a" : "#3f9b2f", { p: [0.3 + Math.cos(a) * 0.8, 2.85, Math.sin(a) * 0.8], r: [0, -a + Math.PI / 2, 0.4] });
    }),
    part(P.sphere(0.12, 5, 4), "#7a4b26", { p: [0.35, 2.7, 0.15] }),
    part(P.sphere(0.12, 5, 4), "#7a4b26", { p: [0.2, 2.72, -0.15] }),
  ]);
const bushGeo = () =>
  merge([
    part(P.ico(0.5, 0), "#3f9b2f", { p: [0, 0.35, 0], s: [1, 0.8, 1] }),
    part(P.ico(0.34, 0), "#5fbe45", { p: [0.35, 0.28, 0.1] }),
    part(P.sphere(0.08, 5, 4), "#ff5d8f", { p: [0.1, 0.65, 0.25] }),
    part(P.sphere(0.08, 5, 4), "#ffd23f", { p: [-0.25, 0.55, 0.1] }),
  ]);
let geoCache: { palm: BufferGeometry; bush: BufferGeometry } | null = null;
const geos = () => (geoCache ??= { palm: palmGeo(), bush: bushGeo() });
const vmat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Thick jungle on an island nobody has bought; it shrinks away when it is ours. */
function Jungle({ runtime, zone }: { runtime: Runtime; zone: ZoneDef }) {
  const items = useMemo(() => {
    const rnd = mulberry32(zone.gx * 17 + zone.gz * 41 + 3);
    const out: { x: number; z: number; s: number; yaw: number; palm: boolean }[] = [];
    const cx = zone.gx * ZONE_W;
    const cz = zone.gz * ZONE_D;
    for (let i = 0; i < 60; i++) out.push({ x: cx + (rnd() - 0.5) * (ZONE_W - 5), z: cz + (rnd() - 0.5) * (ZONE_D - 5), s: 0.8 + rnd() * 0.6, yaw: rnd() * 6.28, palm: rnd() < 0.45 });
    return out;
  }, [zone]);
  const g = useRef<Group>(null);
  const k = useRef(runtime.game.state.zones.has(zone.id) ? 0 : 1);
  useFrame((_, dt) => {
    const r = g.current;
    if (!r) return;
    const open = runtime.game.state.zones.has(zone.id);
    k.current = Math.max(0, Math.min(1, k.current + (open ? -dt * 1.6 : dt * 2)));
    r.visible = k.current > 0.001;
    r.scale.set(1, Math.max(0.001, k.current), 1);
  });
  return (
    <group ref={g}>
      <Instances geometry={geos().palm} items={items.filter((i) => i.palm)} />
      <Instances geometry={geos().bush} items={items.filter((i) => !i.palm)} />
    </group>
  );
}

function Instances({ geometry, items }: { geometry: BufferGeometry; items: { x: number; z: number; s: number; yaw: number }[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    items.forEach((it, i) => {
      dummy.position.set(it.x, 0, it.z);
      dummy.rotation.set(0, it.yaw, 0);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, vmat, Math.max(1, items.length)]} castShadow receiveShadow />;
}

/** Palms along every beach, clear of anything you might walk to. */
function Palms() {
  const items = useMemo(() => {
    const L = ISLAND_LAYOUT;
    const keep: { x: number; z: number; r: number }[] = [
      ...L.pads.map((p) => ({ x: p.x, z: p.z, r: p.size / 2 + 1.2 })),
      ...L.machines.map((m) => ({ x: m.x, z: m.z + 1.5, r: 4.4 })),
      ...L.fields.map((f) => ({ x: f.x, z: f.z, r: 4.6 })),
      { x: L.market.x, z: L.market.z + 1.4, r: 5 },
      { x: L.farmhouse.x, z: L.farmhouse.z + 1, r: 4 },
      { x: L.depot.x, z: L.depot.z + 1.5, r: 5.5 },
      { x: L.statue.x, z: L.statue.z, r: 3 },
      { x: SEAPLANE_STOP.x, z: SEAPLANE_STOP.z, r: 3.4 },
    ];
    const rnd = mulberry32(2026);
    const out: { x: number; z: number; s: number; yaw: number }[] = [];
    for (const z of ISLAND_ZONES) {
      const cx = z.gx * ZONE_W;
      const cz = z.gz * ZONE_D;
      const hw = (ZONE_W - STRAIT) / 2 - 0.9;
      const hd = (ZONE_D - STRAIT) / 2 - 0.9;
      for (let i = 0; i < 14; i++) {
        const side = Math.floor(rnd() * 4);
        const t = rnd() * 2 - 1;
        const x = side < 2 ? cx + t * hw : cx + (side === 2 ? -hw : hw);
        const zz = side < 2 ? cz + (side === 0 ? -hd : hd) : cz + t * hd;
        // Keep the bridges open.
        if (Math.abs(x - cx) < BRIDGE_HALF + 1.2 || Math.abs(zz - cz) < BRIDGE_HALF + 1.2) continue;
        if (keep.some((k) => Math.hypot(k.x - x, k.z - zz) < k.r)) continue;
        // Not in the lagoon or a bay.
        if ([LAGOON, HARBOR_BAY, PEARL_BAY].some((w) => Math.abs(x - w.x) < w.hw + 1.2 && Math.abs(zz - w.z) < w.hd + 1.2)) continue;
        out.push({ x, z: zz, s: 0.85 + rnd() * 0.4, yaw: rnd() * 6.28 });
      }
    }
    // A few far islets on the horizon.
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 70 + rnd() * 40;
      out.push({ x: Math.cos(a) * r, z: -20 + Math.sin(a) * r * 0.8, s: 1.2 + rnd(), yaw: rnd() * 6.28 });
    }
    return out;
  }, []);
  return (
    <group>
      <Instances geometry={geos().palm} items={items} />
      <Islets />
    </group>
  );
}

/** Sand humps far out at sea under the horizon palms. */
function Islets() {
  const items = useMemo(() => {
    const rnd = mulberry32(2026);
    const out: { x: number; z: number; s: number; yaw: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 70 + rnd() * 40;
      out.push({ x: Math.cos(a) * r, z: -20 + Math.sin(a) * r * 0.8, s: 2.5, yaw: 0 });
    }
    return out;
  }, []);
  const geo = useMemo(() => merge([part(P.sphere(1, 10, 6), SAND, { s: [1.6, 0.25, 1.3] })]), []);
  return <Instances geometry={geo} items={items} />;
}

// ── bridges between bought islands ──────────────────────────────────────
function Bridges({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const list = useMemo(() => {
    void structure;
    const zones = runtime.game.state.zones;
    const open = new Set(ISLAND_ZONES.filter((z) => zones.has(z.id)).map((z) => `${z.gx},${z.gz}`));
    const out: { x: number; z: number; along: "x" | "z" }[] = [];
    for (const z of ISLAND_ZONES) {
      if (!open.has(`${z.gx},${z.gz}`)) continue;
      if (open.has(`${z.gx + 1},${z.gz}`)) out.push({ x: (z.gx + 0.5) * ZONE_W, z: z.gz * ZONE_D, along: "x" });
      if (open.has(`${z.gx},${z.gz - 1}`)) out.push({ x: z.gx * ZONE_W, z: (z.gz - 0.5) * ZONE_D, along: "z" });
    }
    return out;
  }, [runtime, structure]);
  return (
    <group>
      {list.map((b) => (
        <Bridge key={`${b.x},${b.z}`} {...b} />
      ))}
    </group>
  );
}

function Bridge({ x, z, along }: { x: number; z: number; along: "x" | "z" }) {
  const len = STRAIT + 1.6;
  const wide = BRIDGE_HALF * 2;
  return (
    <StaticBatch position={[x, 0, z]} rotation={[0, along === "x" ? 0 : Math.PI / 2, 0]}>
      {Array.from({ length: 7 }, (_, i) => (
        <Part key={i} g={G.box(len / 7 - 0.05, 0.08, wide)} c={i % 2 ? "#b07a45" : "#c98b52"} position={[-len / 2 + (i + 0.5) * (len / 7), 0.06, 0]} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Part g={G.box(len, 0.06, 0.08)} c="#8a5a33" position={[0, 0.65, s * (wide / 2 - 0.05)]} />
          {[-len / 2 + 0.1, 0, len / 2 - 0.1].map((px) => (
            <Part key={px} g={G.cyl(0.05, 0.05, 0.7, 5)} c="#8a5a33" position={[px, 0.35, s * (wide / 2 - 0.05)]} />
          ))}
        </group>
      ))}
    </StaticBatch>
  );
}

// ── buildings ───────────────────────────────────────────────────────────
function IslandBuildings({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const st = runtime.game.state;
  const machines = useMemo(() => {
    void structure;
    return [...runtime.game.state.machines] as Machine[];
  }, [runtime, structure]);
  return (
    <group>
      {machines.map((m) => (
        <MachineView key={m.id} m={m} />
      ))}
      <BeachMarket runtime={runtime} />
      <Bungalow />
      <Bin />
      <Torches />
      <SeaplaneStop runtime={runtime} />
      {st.depot && <Harbor runtime={runtime} />}
      {st.statue && <Lighthouse />}
    </group>
  );
}

function BeachMarket({ runtime }: { runtime: Runtime }) {
  const M = ISLAND_MARKET;
  const w = M.w;
  return (
    <group>
      <StaticBatch>
        <Plaza x={M.x} z={(M.z - M.d / 2 + M.sell.z + M.sell.d / 2) / 2} w={M.w + 2.2} d={M.sell.z + M.sell.d / 2 - (M.z - M.d / 2) + 1.4} color="#f4e6b8" rim="#d9c48a" />
        <group position={[M.x, 0, M.z]}>
          <Part g={G.box(w, 0.95, 1.1)} c="#c98b52" position={[0, 0.475, 0.55]} />
          <Part g={G.box(w + 0.1, 0.1, 1.25)} c="#e0a96d" position={[0, 1.0, 0.55]} />
          <Part g={G.box(w, 1.5, 0.5)} c="#b57a45" position={[0, 0.75, -0.95]} />
          {[
            [-w / 2 + 0.1, 1.25],
            [w / 2 - 0.1, 1.25],
            [-w / 2 + 0.1, -1.2],
            [w / 2 - 0.1, -1.2],
          ].map(([x, z], i) => (
            <Part key={i} g={G.cyl(0.08, 0.1, 2.6, 6)} c="#c9a45a" position={[x, 1.3, z]} />
          ))}
          {/* A thatched roof instead of the farm's striped awning. */}
          <Part g={G.cone(3.6, 1.4, 4)} c="#d9b45a" position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.75]} />
          {[
            [-1.5, "#f2c230"],
            [-0.5, "#ffe14d"],
            [0.5, "#7a4b26"],
            [1.5, "#ff8fb1"],
          ].map(([x, c]) => (
            <group key={x as number} position={[x as number, 1.05, 0.55]}>
              <Part g={G.box(0.7, 0.25, 0.6)} c="#a8642a" position={[0, 0.12, 0]} />
              {[-0.18, 0, 0.18].map((dx) => (
                <Part key={dx} g={G.sphere(0.1, 6, 4)} c={c as string} position={[dx, 0.3, 0.05 * Math.sign(dx)]} />
              ))}
            </group>
          ))}
        </group>
        <group position={[M.sell.x, 0, M.sell.z]}>
          <Decal w={M.sell.w} d={M.sell.d} spec={{ icon: "💰", text: "ПРОДАЖА", bg: "rgba(255,204,51,0.35)", color: "#fff1a8" }} y={0.06} />
        </group>
      </StaticBatch>
      <group position={[M.x, 4.3, M.z]} rotation={[-0.32, 0, 0]} userData={DYNAMIC}>
        <OrderBoard runtime={runtime} />
      </group>
    </group>
  );
}

function Bungalow() {
  const H = ISLAND_HOUSE;
  return (
    <group>
      <StaticBatch>
        <group position={[H.x, 0, H.z]}>
          {/* On stilts over the sand. */}
          {[-1.8, 1.8].map((x) => [-1.2, 1.2].map((z) => <Part key={`${x}${z}`} g={G.cyl(0.1, 0.1, 0.7, 6)} c="#8a5a33" position={[x, 0.35, z]} />))}
          <Part g={G.box(4.3, 0.18, 3.3)} c="#b07a45" position={[0, 0.75, 0]} />
          <Part g={G.box(4.0, 1.8, 3.0)} c="#e8d8b0" position={[0, 1.75, 0]} />
          <Part g={G.cone(3.3, 1.6, 4)} c="#d9b45a" position={[0, 3.45, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.8]} />
          <Part g={G.box(0.9, 1.3, 0.08)} c="#7a4b26" position={[0, 1.5, 1.52]} />
          {[-1.3, 1.3].map((x) => (
            <Part key={x} g={G.box(0.8, 0.6, 0.08)} c="#8fd3f5" m={windowMat} position={[x, 1.9, 1.52]} />
          ))}
          <Part g={G.box(1.4, 0.12, 0.9)} c="#c98b52" position={[0, 0.45, 2.05]} />
          <Part g={G.box(1.4, 0.12, 0.5)} c="#c98b52" position={[0, 0.2, 2.6]} />
        </group>
        <group position={[H.door.x, 0, H.door.z]}>
          <Decal w={H.door.w} d={H.door.d} spec={{ icon: "⬆️", text: "УЛУЧШЕНИЯ", bg: "rgba(176,108,255,0.35)", color: "#f0dcff" }} y={0.06} />
        </group>
      </StaticBatch>
      <group position={[H.x, 2.75, H.z + 1.56]}>
        <Sign text="БУНГАЛО" w={1.4} h={0.32} color="#7a4b26" textColor="#ffe9a8" />
      </group>
    </group>
  );
}

function Bin() {
  const T = ISLAND_TRASH;
  return (
    <StaticBatch>
      <group position={[T.x, 0, T.z - T.d / 2 - 0.45]}>
        <Part g={G.cyl(0.5, 0.42, 0.8, 8)} c="#b07a45" position={[0, 0.4, 0]} />
        <Part g={G.torus(0.47, 0.05, 4, 10)} c="#8a5a33" position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <group position={[T.x, 0, T.z]}>
        <Decal w={T.w} d={T.d} spec={{ icon: "🗑️", text: "ВЫБРОСИТЬ", bg: "rgba(120,90,60,0.35)", color: "#f0e0c8" }} y={0.06} />
      </group>
    </StaticBatch>
  );
}

/** Tiki torches by the market and the bungalow: they light up at night. */
function Torches() {
  const list = useMemo(
    () => [
      { x: ISLAND_MARKET.x - 3.4, z: ISLAND_MARKET.z + 3.6 },
      { x: ISLAND_MARKET.x + 3.4, z: ISLAND_MARKET.z + 3.6 },
      { x: ISLAND_HOUSE.x + 2.8, z: ISLAND_HOUSE.z + 2.6 },
      { x: SEAPLANE_STOP.x - 2.2, z: SEAPLANE_STOP.z - 0.6 },
      { x: ISLAND_DEPOT.x - 3.8, z: ISLAND_DEPOT.z + 2.6 },
    ],
    [],
  );
  return (
    <group>
      <StaticBatch>
        {list.map((l, i) => (
          <group key={i} position={[l.x, 0, l.z]}>
            <Part g={G.cyl(0.06, 0.08, 1.9, 5)} c="#8a5a33" position={[0, 0.95, 0]} />
            <Part g={G.cyl(0.14, 0.1, 0.3, 6)} c="#5a3a22" position={[0, 1.95, 0]} />
          </group>
        ))}
      </StaticBatch>
      {list.map((l, i) => (
        <mesh key={i} geometry={G.cone(0.13, 0.36, 6)} material={lanternMat} position={[l.x, 2.25, l.z]} />
      ))}
    </group>
  );
}

/** The seaplane's jetty: the plane taxis in when you stand on it. */
function SeaplaneStop({ runtime }: { runtime: Runtime }) {
  const S = SEAPLANE_STOP;
  const plane = useRef<Group>(null);
  const k = useRef(0);
  useFrame((state, dt) => {
    const g = plane.current;
    if (!g) return;
    const here = runtime.game.state.player.zoneId === "bus";
    k.current = Math.max(0, Math.min(1, k.current + (here ? dt / 1.4 : -dt / 1.0)));
    const e = 1 - Math.pow(1 - k.current, 3);
    g.position.set(S.x - (1 - e) * 30, 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.04, S.z + 3.4);
    g.visible = true;
  });
  return (
    <group>
      <StaticBatch>
        <group position={[S.x, 0, S.z]}>
          <Decal w={S.w} d={S.d} spec={{ icon: "✈️", text: "ГИДРОПЛАН", bg: "rgba(63,167,255,0.35)", color: "#e0f2ff" }} y={0.07} />
        </group>
        {/* The jetty out into the sea. */}
        {Array.from({ length: 6 }, (_, i) => (
          <Part key={i} g={G.box(1.6, 0.08, 0.5)} c={i % 2 ? "#b07a45" : "#c98b52"} position={[S.x, 0.05, S.z + 1.2 + i * 0.55]} />
        ))}
      </StaticBatch>
      <group ref={plane} userData={DYNAMIC}>
        <StaticBatch>
          <Part g={G.box(2.6, 0.55, 0.6)} c="#f4efe2" position={[0, 1.1, 0]} />
          <Part g={G.box(0.5, 0.06, 4.2)} c="#e85d4a" position={[0.1, 1.45, 0]} />
          <Part g={G.box(0.4, 0.5, 0.06)} c="#e85d4a" position={[-1.2, 1.5, 0]} />
          <Part g={G.box(0.06, 0.4, 0.5)} c="#bfe8ff" position={[1.3, 1.2, 0]} />
          {[-0.9, 0.9].map((z) => (
            <Part key={z} g={G.box(2.2, 0.22, 0.32)} c="#3a4a5a" position={[0, 0.15, z]} />
          ))}
          {[-0.9, 0.9].map((z) => (
            <Part key={`s${z}`} g={G.box(0.06, 0.8, 0.06)} c="#6a6a6a" position={[0, 0.65, z]} />
          ))}
          <Part g={G.box(0.06, 0.9, 0.12)} c="#3a3a3a" position={[1.35, 1.1, 0]} />
        </StaticBatch>
      </group>
    </group>
  );
}

function Harbor({ runtime }: { runtime: Runtime }) {
  const D = ISLAND_DEPOT;
  const boats = runtime.game.state.depot?.trucks ?? [];
  return (
    <group>
      <StaticBatch>
        <Plaza x={D.x} z={D.z + 1.6} w={D.w + 1.6} d={D.d + 4.4} color="#e8d8b0" rim="#c9b07a" />
        <group position={[D.x, 0, D.z]}>
          <Part g={G.box(D.w, 2.6, D.d)} c="#c9a477" position={[0, 1.3, 0]} />
          {Array.from({ length: 9 }, (_, i) => (
            <Part key={i} g={G.box(0.06, 2.5, D.d + 0.04)} c="#b08a5a" position={[-D.w / 2 + 0.35 + i * 0.66, 1.3, 0]} />
          ))}
          <Part g={G.cone(D.w * 0.78, 1.5, 4)} c="#d9b45a" position={[0, 3.35, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.7]} />
          <Part g={G.box(2.6, 1.9, 0.1)} c="#7a4b26" position={[-0.6, 0.95, D.d / 2 + 0.02]} />
        </group>
        <group position={[D.input.x, 0, D.input.z]}>
          <Pallet w={D.input.w - 0.1} d={D.input.d - 0.1} />
          <Decal w={D.input.w} d={D.input.d} spec={{ icon: "📦", text: "НА ЛОДКИ ×1.5", bg: "rgba(63,167,255,0.3)" }} y={0.08} />
        </group>
        {/* Moorings along the bay. */}
        {Array.from({ length: 10 }, (_, i) => (
          <Part key={i} g={G.box(0.55, 0.1, 1.4)} c={i % 2 ? "#b07a45" : "#c98b52"} position={[HARBOR_BAY.x - HARBOR_BAY.hw + 0.3 + i * 0.6, 0.08, HARBOR_BAY.z - HARBOR_BAY.hd - 0.2]} />
        ))}
      </StaticBatch>
      <group position={[D.x + 1.9, 2.1, D.z + D.d / 2 + 0.06]}>
        <Sign text="ГАВАНЬ" w={1.8} h={0.5} color="#2f5a72" />
      </group>
      {boats.map((t, i) => (
        <BoatView key={t.id} runtime={runtime} truck={t} index={i} />
      ))}
    </group>
  );
}

function BoatView({ runtime, truck, index }: { runtime: Runtime; truck: Truck; index: number }) {
  const g = useRef<Group>(null);
  const wake = useRef(0);
  const last = useRef(truck.x);
  useFrame((state, dt) => {
    const r = g.current;
    if (!r) return;
    const t = runtime.game.state.depot?.trucks[index] ?? truck;
    r.visible = t.x < TRUCK_FAR_X - 0.5;
    r.position.set(t.x, Math.sin(state.clock.elapsedTime * 1.8 + index) * 0.05, t.z);
    r.rotation.x = Math.sin(state.clock.elapsedTime * 1.3 + index) * 0.03;
    const dx = t.x - last.current;
    last.current = t.x;
    if (Math.abs(dx) > 0.001) {
      wake.current += dt;
      if (wake.current > 0.1) {
        wake.current = 0;
        fx.smoke(t.x + 2.4, 0.15, t.z + (Math.random() - 0.5) * 0.8, "#ffffff", 0.2);
      }
    }
  });
  const colors = ["#e85d4a", "#3fa7ff", "#ffb238"];
  return (
    <group ref={g} userData={DYNAMIC}>
      <StaticBatch>
        {/* Bow faces −x. */}
        <Part g={G.box(3.6, 0.5, 1.6)} c={colors[index % colors.length]} position={[0.5, 0.25, 0]} />
        <Part g={G.cone(0.82, 1.1, 4)} c={colors[index % colors.length]} position={[-1.85, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.6, 1, 1]} />
        <Part g={G.box(3.5, 0.08, 1.5)} c="#c98b52" position={[0.5, 0.52, 0]} />
        <Part g={G.box(0.9, 0.9, 1.1)} c="#f4efe2" position={[-1.0, 0.95, 0]} />
        <Part g={G.box(0.06, 0.45, 0.9)} c="#bfe8ff" position={[-1.47, 1.05, 0]} />
        <Part g={G.cyl(0.04, 0.04, 2.2, 5)} c="#8a5a33" position={[0.2, 1.6, 0]} />
        <Part g={G.cone(0.7, 1.6, 3)} c="#f4efe2" position={[0.55, 1.75, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.15, 1, 1]} />
      </StaticBatch>
    </group>
  );
}

/** The finale: a striped lighthouse whose light sweeps over the sea at night. */
function Lighthouse() {
  const L = LIGHTHOUSE;
  const beam = useRef<Group>(null);
  const beamMat = useMemo(() => new MeshBasicMaterial({ color: "#fff3b0", transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false }), []);
  useFrame((state) => {
    if (beam.current) beam.current.rotation.y = state.clock.elapsedTime * 0.8;
    beamMat.opacity = 0.05 + nightLevel() * 0.35;
  });
  return (
    <group position={[L.x, 0, L.z]}>
      <StaticBatch>
        <Part g={G.cyl(1.7, 1.9, 0.6, 10)} c="#8f97a0" position={[0, 0.3, 0]} />
        {Array.from({ length: 6 }, (_, i) => (
          <Part key={i} g={G.cyl(1.05 - i * 0.07, 1.12 - i * 0.07, 1.2, 10)} c={i % 2 ? "#ffffff" : "#e8413c"} position={[0, 1.2 + i * 1.2, 0]} />
        ))}
        <Part g={G.cyl(0.9, 0.9, 0.15, 10)} c="#3a3f44" position={[0, 7.85, 0]} />
        <Part g={G.cone(0.75, 0.8, 10)} c="#e8413c" position={[0, 9.0, 0]} />
      </StaticBatch>
      <mesh geometry={G.cyl(0.6, 0.6, 0.8, 10)} material={lanternMat} position={[0, 8.3, 0]} />
      <group ref={beam} position={[0, 8.3, 0]}>
        <mesh material={beamMat} rotation={[0, 0, Math.PI / 2]} position={[7, 0, 0]}>
          <coneGeometry args={[1.6, 14, 12, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

/** For the HUD's bounds etc. */
export const ISLAND_VIEW_BOUNDS = ISLAND_BOUNDS;
