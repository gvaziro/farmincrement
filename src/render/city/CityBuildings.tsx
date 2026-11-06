"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { easeOutBack } from "@/game/core/math";
import { CITY_BUS_STOP, CITY_OFFICE, FACADE, FARM_BUS_STOP, FOUNTAIN, ROAD_DZ, TOWER, TOWER_FLOORS, VAN_FAR, type Box, type ShelfDef } from "@/game/data/city";
import { ITEMS } from "@/game/data/items";
import { CITY_ZONES, ZONE_D, ZONE_W } from "@/game/data/layout";
import type { ShopState, TableState } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { MachineView } from "../buildings/Buildings";
import { Decal, Sign } from "../buildings/parts";
import { fx } from "../fx";
import { G, Part } from "../kit";
import { lanternMat, windowMat } from "../nightMaterials";
import { Plaza } from "../shapes";
import { DYNAMIC, StaticBatch } from "../StaticBatch";

export function CityBuildings({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const { machines, shops } = useMemo(() => {
    void structure;
    const st = runtime.game.state;
    return { machines: [...st.machines], shops: st.city ? [...st.city.shops] : [] };
  }, [runtime, structure]);
  const zones = useMemo(() => {
    void structure;
    return new Set(runtime.game.state.zones);
  }, [runtime, structure]);
  return (
    <group>
      {machines.map((m) => (
        <MachineView key={m.id} m={m} />
      ))}
      {shops.map((s) => (
        <Shop key={s.id} shop={s} structure={structure} />
      ))}
      {shops.map((s) => (
        <VanView key={s.id} runtime={runtime} shop={s} />
      ))}
      <Office />
      <BusStop runtime={runtime} box={CITY_BUS_STOP} label="НА ФЕРМУ" roadDz={2.85} />
      <Cars runtime={runtime} />
      <StreetLamps />
      {zones.has("c_park") && <Park />}
      {zones.has("c_tower") && <Tower />}
    </group>
  );
}

// ── a business ──────────────────────────────────────────────────────────
function Shop({ shop, structure }: { shop: ShopState; structure: number }) {
  const shelves = useMemo(() => {
    void structure;
    return [...shop.shelves];
  }, [shop, structure]);
  const tables = useMemo(() => {
    void structure;
    return [...shop.tables];
  }, [shop, structure]);
  const delivery = shop.delivery;
  return (
    <group>
      <Facade shop={shop} />
      <Till shop={shop} />
      {shelves.map((s) => (
        <Counter key={s.id} def={s.def} shop={shop} />
      ))}
      {tables.map((t) => (
        <TableView key={t.id} table={t} awning={shop.def.awning} />
      ))}
      {delivery && shop.def.delivery && <Delivery box={shop.def.delivery} />}
    </group>
  );
}

function Facade({ shop }: { shop: ShopState }) {
  const d = shop.def;
  const z = d.cz + FACADE.dz;
  const h = 3.4;
  const n = 7;
  return (
    <group>
      <StaticBatch>
        {/* Floor from the wall to the customers' side. */}
        <Plaza x={d.cx} z={d.cz - 4.7} w={FACADE.w + 4} d={12.2} color="#f0e6d2" rim={d.trim} />
        <group position={[d.cx, 0, z]}>
          <Part g={G.box(FACADE.w, h, FACADE.d)} c={d.wall} position={[0, h / 2, 0]} />
          <Part g={G.box(FACADE.w + 0.3, 0.26, FACADE.d + 0.3)} c={d.trim} position={[0, h + 0.13, 0]} />
          <Part g={G.box(FACADE.w + 0.1, 0.4, FACADE.d + 0.1)} c={d.trim} position={[0, 0.2, 0]} />
          {/* Windows and a door in the middle. */}
          {Array.from({ length: n }, (_, i) => {
            const x = (i - (n - 1) / 2) * 2.7;
            if (i === (n - 1) / 2) {
              return (
                <group key={i} position={[x, 0, FACADE.d / 2]}>
                  <Part g={G.box(1.3, 2.2, 0.08)} c="#ffffff" position={[0, 1.1, 0.02]} />
                  <Part g={G.box(1.1, 2.05, 0.1)} c={d.trim} position={[0, 1.04, 0.03]} />
                  <Part g={G.box(0.8, 0.9, 0.11)} c="#8fd3f5" m={windowMat} position={[0, 1.45, 0.04]} />
                </group>
              );
            }
            return (
              <group key={i} position={[x, 1.55, FACADE.d / 2]}>
                <Part g={G.box(1.8, 1.4, 0.06)} c="#ffffff" position={[0, 0, 0.02]} />
                <Part g={G.box(1.6, 1.2, 0.08)} c="#8fd3f5" m={windowMat} position={[0, 0, 0.03]} />
                {[-0.6, -0.2, 0.2, 0.6].map((sx, k) => (
                  <Part key={sx} g={G.box(0.42, 0.06, 0.55)} c={k % 2 ? "#ffffff" : d.awning} position={[sx, 0.82, 0.24]} rotation={[0.5, 0, 0]} />
                ))}
              </group>
            );
          })}
        </group>
      </StaticBatch>
      <group position={[d.cx, h + 0.6, z + FACADE.d / 2 + 0.05]}>
        <Part g={G.box(9.4, 1.0, 0.1)} c={d.trim} position={[0, 0, -0.08]} />
        <Sign text={d.sign} w={9} h={0.82} color={d.awning} textColor="#ffffff" />
      </group>
    </group>
  );
}

function Till({ shop }: { shop: ShopState }) {
  const d = shop.def;
  const r = d.register;
  const body = useRef<Group>(null);
  useFrame(() => {
    if (body.current) {
      const s = 1 + shop.pulse * 0.08;
      body.current.scale.set(s, s, s);
    }
  });
  return (
    <group>
      <StaticBatch>
        <group position={[r.x, 0, r.z]}>
          <Part g={G.box(r.w, 0.9, r.d)} c={d.trim} position={[0, 0.45, 0]} />
          <Part g={G.box(r.w + 0.12, 0.08, r.d + 0.12)} c="#f4efe2" position={[0, 0.94, 0]} />
        </group>
      </StaticBatch>
      <group ref={body} position={[r.x, 0.98, r.z]} userData={DYNAMIC}>
        <StaticBatch>
          <Part g={G.box(0.75, 0.32, 0.55)} c="#4a5560" position={[0, 0.16, 0]} />
          <Part g={G.box(0.7, 0.22, 0.05)} c="#a8e0a0" position={[0, 0.42, -0.14]} rotation={[-0.3, 0, 0]} />
          <Part g={G.box(0.55, 0.05, 0.3)} c="#cfd8dc" position={[0, 0.34, 0.08]} />
        </StaticBatch>
      </group>
      <group position={[d.till.x, 0, d.till.z]}>
        <Decal w={d.till.w} d={d.till.d} spec={{ icon: "🧾", text: "КАССА", bg: "rgba(63,167,255,0.32)", color: "#d8eeff" }} y={0.06} />
      </group>
      <group position={[d.cash.x, 0, d.cash.z]}>
        <Decal w={d.cash.w} d={d.cash.d} spec={{ icon: "💵", text: "ВЫРУЧКА", bg: "rgba(95,190,85,0.32)", color: "#dcffd0" }} y={0.06} />
      </group>
      <group position={[d.bin.x, 0, d.bin.z]}>
        <Decal w={d.bin.w} d={d.bin.d} spec={{ icon: "🗑️", text: "ВЫБРОСИТЬ", bg: "rgba(120,120,120,0.3)", color: "#eeeeee" }} y={0.06} />
      </group>
      <StaticBatch position={[d.bin.x, 0, d.bin.z - d.bin.d / 2 - 0.42]}>
        <Part g={G.cyl(0.42, 0.34, 0.8, 10)} c="#5f7f6a" position={[0, 0.4, 0]} />
        <Part g={G.cyl(0.46, 0.46, 0.08, 10)} c="#3f5a4a" position={[0, 0.84, 0]} />
      </StaticBatch>
    </group>
  );
}

/** A counter: the goods lie on top, staff stand behind it, customers in front. */
function Counter({ def, shop }: { def: ShelfDef; shop: ShopState }) {
  const g = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (g.current) {
      const k = t.current < 0.6 ? Math.max(0.001, easeOutBack(t.current / 0.6, 2)) : 1;
      g.current.scale.setScalar(k);
    }
  });
  const b = def.box;
  return (
    <group>
      <group ref={g} position={[b.x, 0, b.z]} userData={DYNAMIC}>
        <StaticBatch>
          <Part g={G.box(b.w, 0.88, b.d)} c={shop.def.wall} position={[0, 0.44, 0]} />
          <Part g={G.box(b.w + 0.04, 0.1, b.d + 0.08)} c="#f4efe2" position={[0, 0.93, 0]} />
          <Part g={G.box(b.w - 0.3, 0.5, 0.04)} c={shop.def.awning} position={[0, 0.5, b.d / 2 + 0.01]} />
        </StaticBatch>
      </group>
      <group position={[def.staff.x, 0, def.staff.z]}>
        <Decal w={def.staff.w} d={def.staff.d} spec={{ icon: ITEMS[def.item].icon, item: def.item, arrow: "in", bg: "rgba(63,167,255,0.22)" }} y={0.06} opacity={0.85} />
      </group>
    </group>
  );
}

function TableView({ table, awning }: { table: TableState; awning: string }) {
  const t = table.def;
  return (
    <StaticBatch position={[t.x, 0, t.z]}>
      <Part g={G.cyl(0.46, 0.46, 0.07, 12)} c="#f4efe2" position={[0, 0.82, 0]} />
      <Part g={G.cyl(0.05, 0.08, 0.8, 6)} c="#6a6a6a" position={[0, 0.4, 0]} />
      <Part g={G.cyl(0.22, 0.26, 0.05, 8)} c="#6a6a6a" position={[0, 0.03, 0]} />
      <Part g={G.cyl(0.03, 0.03, 1.5, 5)} c="#8a8a8a" position={[0, 1.55, 0]} />
      <Part g={G.cone(0.8, 0.36, 8)} c={awning} position={[0, 2.3, 0]} />
    </StaticBatch>
  );
}

function Delivery({ box }: { box: Box }) {
  return (
    <group>
      <group position={[box.x, 0, box.z]}>
        <Decal w={box.w} d={box.d} spec={{ icon: "🛵", text: "ДОСТАВКА ×1.3", bg: "rgba(255,159,28,0.32)", color: "#fff0d0" }} y={0.06} />
      </group>
      <StaticBatch position={[box.x, 0, box.z + box.d / 2 + 0.62]} rotation={[0, Math.PI / 2, 0]}>
        <Part g={G.cyl(0.2, 0.2, 0.1, 10)} c="#2b2b2b" position={[0.5, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Part g={G.cyl(0.2, 0.2, 0.1, 10)} c="#2b2b2b" position={[-0.5, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Part g={G.box(1.0, 0.22, 0.28)} c="#e8413c" position={[0, 0.42, 0]} />
        <Part g={G.box(0.5, 0.14, 0.26)} c="#3a3a3a" position={[-0.18, 0.58, 0]} />
        <Part g={G.box(0.08, 0.5, 0.08)} c="#cfd8dc" position={[0.42, 0.72, 0]} rotation={[0, 0, -0.25]} />
        <Part g={G.box(0.5, 0.42, 0.5)} c="#ffb238" position={[-0.45, 0.78, 0]} />
      </StaticBatch>
    </group>
  );
}

// ── the owner's office ──────────────────────────────────────────────────
function Office() {
  const o = CITY_OFFICE;
  return (
    <group>
      <StaticBatch>
        <group position={[o.x, 0, o.z]}>
          <Part g={G.box(o.w, 2.5, o.d)} c="#b8c4cc" position={[0, 1.25, 0]} />
          <Part g={G.box(o.w + 0.26, 0.2, o.d + 0.26)} c="#5d7a8c" position={[0, 2.6, 0]} />
          <Part g={G.box(0.9, 1.7, 0.08)} c="#5d7a8c" position={[0, 0.85, o.d / 2 + 0.02]} />
          <Part g={G.box(0.7, 0.8, 0.1)} c="#8fd3f5" m={windowMat} position={[0, 1.2, o.d / 2 + 0.03]} />
          {[-1.45, 1.45].map((x) => (
            <Part key={x} g={G.box(0.95, 1.0, 0.1)} c="#8fd3f5" m={windowMat} position={[x, 1.4, o.d / 2 + 0.02]} />
          ))}
          <Part g={G.box(0.6, 0.5, 0.6)} c="#8a8a8a" position={[1.2, 2.95, -0.6]} />
        </group>
      </StaticBatch>
      <group position={[o.x, 2.2, o.z + o.d / 2 + 0.08]}>
        <Sign text="КОНТОРА" w={1.5} h={0.36} color="#3a5566" />
      </group>
      <group position={[o.door.x, 0, o.door.z]}>
        <Decal w={o.door.w} d={o.door.d} spec={{ icon: "⬆️", text: "УЛУЧШЕНИЯ", bg: "rgba(176,108,255,0.35)", color: "#f0dcff" }} y={0.06} />
      </group>
    </group>
  );
}

// ── the bus stop: the same on the farm and in town ──────────────────────
export function BusStop({ runtime, box, label, roadDz }: { runtime: Runtime; box: Box; label: string; roadDz: number }) {
  return (
    <group position={[box.x, 0, box.z]}>
      <BusView runtime={runtime} dz={roadDz} />
      <Decal w={box.w} d={box.d} spec={{ icon: "🚌", text: label, bg: "rgba(255,178,56,0.4)", color: "#fff2c8" }} y={0.06} />
      <StaticBatch position={[-box.w / 2 - 0.35, 0, 0]}>
        <Part g={G.cyl(0.05, 0.05, 2.2, 6)} c="#6a7480" position={[0, 1.1, 0]} />
        <Part g={G.box(0.62, 0.62, 0.06)} c="#3f8fd9" position={[0, 2.2, 0]} />
        <Part g={G.box(0.44, 0.22, 0.08)} c="#ffffff" position={[0, 2.26, 0]} />
        <Part g={G.box(0.18, 0.08, 0.09)} c="#2b2b2b" position={[-0.1, 2.08, 0]} />
        <Part g={G.box(0.18, 0.08, 0.09)} c="#2b2b2b" position={[0.1, 2.08, 0]} />
      </StaticBatch>
      <StaticBatch position={[box.w / 2 + 0.15, 0, -0.1]}>
        <Part g={G.box(0.5, 0.08, 1.5)} c="#a8642a" position={[0, 0.48, 0]} />
        <Part g={G.box(0.08, 0.48, 1.3)} c="#8a5a33" position={[0.18, 0.74, 0]} />
        <Part g={G.box(0.4, 0.46, 0.08)} c="#6a6a6a" position={[0, 0.23, 0.6]} />
        <Part g={G.box(0.4, 0.46, 0.08)} c="#6a6a6a" position={[0, 0.23, -0.6]} />
      </StaticBatch>
    </group>
  );
}

/** It comes when you stand at the stop, and drives off when you walk away. */
function BusView({ runtime, dz }: { runtime: Runtime; dz: number }) {
  const g = useRef<Group>(null);
  const k = useRef(0);
  useFrame((_, dt) => {
    const r = g.current;
    if (!r) return;
    const here = runtime.game.state.player.zoneId === "bus";
    k.current = Math.max(0, Math.min(1, k.current + (here ? dt / 1.1 : -dt / 0.8)));
    r.visible = k.current > 0.001;
    const e = 1 - Math.pow(1 - k.current, 3);
    r.position.set((1 - e) * 26, 0, dz);
  });
  return (
    <group ref={g} userData={DYNAMIC} visible={false}>
      <StaticBatch>
        {/* Faces −x. */}
        <Part g={G.box(5.2, 1.7, 1.7)} c="#ffb238" position={[0, 1.25, 0]} />
        <Part g={G.box(5.24, 0.5, 1.74)} c="#f4efe2" position={[0, 0.65, 0]} />
        <Part g={G.box(5.1, 0.14, 1.6)} c="#e8913a" position={[0, 2.15, 0]} />
        <Part g={G.box(0.06, 0.8, 1.4)} c="#bfe8ff" position={[-2.62, 1.4, 0]} />
        {[-1.7, -0.7, 0.3, 1.3, 2.2].map((x) => (
          <Part key={x} g={G.box(0.8, 0.62, 0.05)} c="#bfe8ff" position={[x, 1.5, -0.87]} />
        ))}
        {[-1.6, 1.6].map((x) =>
          [0.82, -0.82].map((z) => <Part key={`${x}${z}`} g={G.cyl(0.36, 0.36, 0.2, 10)} c="#2b2b2b" position={[x, 0.36, z]} rotation={[Math.PI / 2, 0, 0]} />),
        )}
        <Part g={G.box(0.2, 0.16, 0.3)} c="#fff7b0" position={[-2.6, 0.72, 0.55]} />
        <Part g={G.box(0.2, 0.16, 0.3)} c="#fff7b0" position={[-2.6, 0.72, -0.55]} />
      </StaticBatch>
    </group>
  );
}

/** The stop by the farm's south fence: it is there once the statue has been built. */
export function FarmBusStop({ runtime }: { runtime: Runtime }) {
  const bus = useUI((s) => s.bus);
  if (!bus) return null;
  return <BusStop runtime={runtime} box={FARM_BUS_STOP} label="В ГОРОД" roadDz={2.9} />;
}

// ── the farm's van ──────────────────────────────────────────────────────
function VanView({ runtime, shop }: { runtime: Runtime; shop: ShopState }) {
  const g = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const last = useRef(shop.van.x);
  const smoke = useRef(0);
  useFrame((_, dt) => {
    const r = g.current;
    if (!r) return;
    const s = runtime.game.shop(shop.id) ?? shop;
    const v = s.van;
    r.visible = Math.abs(v.x - s.def.bay) < VAN_FAR - 0.5;
    r.position.set(v.x, 0, v.z);
    const dx = v.x - last.current;
    last.current = v.x;
    for (const w of wheels.current) if (w) w.rotation.z -= dx / 0.3;
    if (Math.abs(dx) > 0.001) {
      smoke.current += dt;
      if (smoke.current > 0.14) {
        smoke.current = 0;
        fx.smoke(v.x + 1.6, 0.35, v.z + 0.4, "#cfcfcf", 0.16);
      }
    }
  });
  return (
    <group ref={g} userData={DYNAMIC}>
      <StaticBatch>
        {/* Cab faces −x. */}
        <Part g={G.box(0.95, 1.05, 1.28)} c="#7cc24f" position={[-1.05, 0.88, 0]} />
        <Part g={G.box(0.05, 0.42, 1.08)} c="#bfe8ff" position={[-1.54, 1.08, 0]} />
        <Part g={G.box(0.22, 0.14, 0.24)} c="#fff7b0" position={[-1.52, 0.56, 0.42]} />
        <Part g={G.box(0.22, 0.14, 0.24)} c="#fff7b0" position={[-1.52, 0.56, -0.42]} />
        <Part g={G.box(2.05, 1.5, 1.34)} c="#f4efe2" position={[0.5, 1.12, 0]} />
        <Part g={G.box(2.07, 0.3, 1.36)} c="#5fae45" position={[0.5, 0.55, 0]} />
        {[
          [-1.05, 0.66],
          [-1.05, -0.66],
          [0.95, 0.66],
          [0.95, -0.66],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0.3, z]} userData={DYNAMIC} ref={(w) => void (wheels.current[i] = w)}>
            <Part g={G.cyl(0.3, 0.3, 0.2, 10)} c="#2b2b2b" rotation={[Math.PI / 2, 0, 0]} />
            <Part g={G.cyl(0.14, 0.14, 0.22, 6)} c="#cfd8dc" rotation={[Math.PI / 2, 0, 0]} />
          </group>
        ))}
      </StaticBatch>
      <group position={[0.5, 1.28, 0.69]}>
        <Sign text="С ФЕРМЫ" w={1.7} h={0.5} color="#5fae45" textColor="#ffffff" />
      </group>
    </group>
  );
}

// ── traffic ─────────────────────────────────────────────────────────────
const CAR_COLORS = ["#e85d4a", "#3fa7ff", "#ffb238", "#8e7cf0", "#4fc3c8", "#f4efe2"];
const ROWS = [...new Set(CITY_ZONES.map((z) => z.gz))];

function Cars({ runtime }: { runtime: Runtime }) {
  const list = useMemo(() => {
    const out: { z: number; x: number; speed: number; color: string }[] = [];
    let i = 0;
    for (const gz of ROWS) {
      for (let k = 0; k < 3; k++) {
        out.push({ z: gz * ZONE_D + ROAD_DZ + 0.8, x: -70 + k * 47 + gz * 11, speed: 5 + ((i * 7) % 4), color: CAR_COLORS[i % CAR_COLORS.length] });
        i++;
      }
    }
    return out;
  }, []);
  const refs = useRef<(Group | null)[]>([]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const p = runtime.game.state.player;
    list.forEach((c, i) => {
      // Cars brake for a farmer on the road.
      const ahead = p.x - c.x;
      const blocked = ahead > 0 && ahead < 3.4 && Math.abs(p.z - c.z) < 1.3;
      if (!blocked) c.x += c.speed * dt;
      if (c.x > 70) c.x = -70;
      const r = refs.current[i];
      if (r) r.position.set(c.x, 0, c.z);
    });
  });
  return (
    <group>
      {list.map((c, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} userData={DYNAMIC}>
          <CarBody color={c.color} />
        </group>
      ))}
    </group>
  );
}

function CarBody({ color }: { color: string }) {
  return (
    <StaticBatch>
      {/* Faces +x. */}
      <Part g={G.box(2.1, 0.42, 1.08)} c={color} position={[0, 0.42, 0]} />
      <Part g={G.box(1.1, 0.42, 0.98)} c={color} position={[-0.15, 0.82, 0]} />
      <Part g={G.box(0.05, 0.3, 0.86)} c="#bfe8ff" position={[0.42, 0.82, 0]} />
      <Part g={G.box(0.05, 0.3, 0.86)} c="#bfe8ff" position={[-0.72, 0.82, 0]} />
      {[
        [0.68, 0.54],
        [0.68, -0.54],
        [-0.68, 0.54],
        [-0.68, -0.54],
      ].map(([x, z], i) => (
        <Part key={i} g={G.cyl(0.2, 0.2, 0.14, 8)} c="#2b2b2b" position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </StaticBatch>
  );
}

// ── street lamps ────────────────────────────────────────────────────────
function StreetLamps() {
  const lamps = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (const z of CITY_ZONES) for (const lx of [-12.2, 12.2]) out.push({ x: z.gx * ZONE_W + lx, z: z.gz * ZONE_D + 7.3 });
    return out;
  }, []);
  return (
    <group>
      <StaticBatch>
        {lamps.map((l, i) => (
          <group key={i} position={[l.x, 0, l.z]}>
            <Part g={G.cyl(0.12, 0.16, 0.2, 6)} c="#5a6068" position={[0, 0.1, 0]} />
            <Part g={G.cyl(0.05, 0.06, 2.9, 6)} c="#3a3f44" position={[0, 1.5, 0]} />
            <Part g={G.box(0.5, 0.05, 0.06)} c="#3a3f44" position={[0, 2.95, 0]} />
          </group>
        ))}
      </StaticBatch>
      {lamps.map((l, i) => (
        <mesh key={i} geometry={G.sphere(0.13, 8, 6)} material={lanternMat} position={[l.x, 2.86, l.z]} />
      ))}
    </group>
  );
}

// ── the park ────────────────────────────────────────────────────────────
function Park() {
  const f = FOUNTAIN;
  const z = CITY_ZONES.find((c) => c.id === "c_park")!;
  const cx = z.gx * ZONE_W;
  const cz = z.gz * ZONE_D;
  const water = useRef<Group>(null);
  useFrame((state) => {
    if (water.current) water.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 5) * 0.05;
  });
  const trees = useMemo(() => {
    const out: { x: number; z: number; s: number; c: string }[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      out.push({ x: cx + Math.cos(a) * (8.4 + (i % 3)), z: cz - 1 + Math.sin(a) * (5.6 + ((i * 2) % 3)), s: 0.9 + ((i * 7) % 5) * 0.12, c: ["#4fae3a", "#5fbe45", "#45a035", "#79c24f"][i % 4] });
    }
    return out;
  }, [cx, cz]);
  return (
    <group>
      <StaticBatch>
        <Plaza x={f.x} z={f.z} w={f.w + 3.4} d={f.d + 3.4} color="#e3d2a6" rim="#c9b07a" />
        <Part g={G.cyl(2.1, 2.2, 0.4, 16)} c="#c9c3b5" position={[f.x, 0.2, f.z]} />
        <Part g={G.cyl(0.5, 0.65, 1.1, 10)} c="#ddd7c9" position={[f.x, 0.8, f.z]} />
        {trees.map((t, i) => (
          <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
            <Part g={G.cyl(0.13, 0.18, 1.1, 6)} c="#7a4b2a" position={[0, 0.55, 0]} />
            <Part g={G.ico(0.85, 1)} c={t.c} position={[0, 1.65, 0]} />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <group key={s} position={[f.x + s * 5, 0, f.z + 3.4]}>
            <Part g={G.box(1.5, 0.08, 0.45)} c="#a8642a" position={[0, 0.46, 0]} />
            <Part g={G.box(1.3, 0.46, 0.08)} c="#6a6a6a" position={[0, 0.23, 0]} />
          </group>
        ))}
      </StaticBatch>
      <mesh position={[f.x, 0.42, f.z]} geometry={G.cyl(1.9, 1.9, 0.06, 16)}>
        <meshLambertMaterial color="#6fb6e8" />
      </mesh>
      <group ref={water} position={[f.x, 1.5, f.z]}>
        <mesh geometry={G.sphere(0.36, 8, 6)}>
          <meshLambertMaterial color="#a8dcf5" />
        </mesh>
      </group>
    </group>
  );
}

// ── the tower ───────────────────────────────────────────────────────────
const FLOOR_H = 3.1;

function Tower() {
  const floors = useUI((s) => s.towerFloors);
  const t = TOWER;
  return (
    <group position={[t.x, 0, t.z]}>
      <StaticBatch>
        <Plaza x={0} z={2.2} w={t.w + 5} d={t.d + 6.6} color="#e9e4d4" rim="#b8b09a" />
        <Part g={G.box(t.w, 0.5, t.d)} c="#8f97a0" position={[0, 0.25, 0]} />
      </StaticBatch>
      {floors === 0 && (
        <StaticBatch>
          {[
            [-t.w / 2 + 0.4, -t.d / 2 + 0.4],
            [t.w / 2 - 0.4, -t.d / 2 + 0.4],
            [-t.w / 2 + 0.4, t.d / 2 - 0.4],
            [t.w / 2 - 0.4, t.d / 2 - 0.4],
          ].map(([x, z], i) => (
            <Part key={i} g={G.box(0.5, 3.4, 0.5)} c="#c9c3b5" position={[x, 2.2, z]} />
          ))}
        </StaticBatch>
      )}
      {Array.from({ length: floors }, (_, i) => (
        <Floor key={i} index={i} />
      ))}
      {floors >= TOWER_FLOORS && <Crown />}
    </group>
  );
}

function Floor({ index }: { index: number }) {
  const t = TOWER;
  const g = useRef<Group>(null);
  const age = useRef(0);
  useFrame((_, dt) => {
    age.current += dt;
    if (g.current) {
      const k = age.current < 0.8 ? Math.max(0.001, easeOutBack(age.current / 0.8, 1.8)) : 1;
      g.current.scale.set(1, k, 1);
    }
  });
  // Each floor steps in a little: the tower narrows towards the top.
  const w = t.w - index * 1.1;
  const d = t.d - index * 0.8;
  const cols = Math.floor(w / 1.5);
  return (
    <group ref={g} position={[0, 0.5 + index * FLOOR_H, 0]} userData={DYNAMIC}>
      <StaticBatch>
        <Part g={G.box(w, FLOOR_H - 0.2, d)} c={index % 2 ? "#6f8fa8" : "#7f9fb8"} position={[0, (FLOOR_H - 0.2) / 2, 0]} />
        <Part g={G.box(w + 0.2, 0.2, d + 0.2)} c="#e9e4d4" position={[0, FLOOR_H - 0.1, 0]} />
        {Array.from({ length: cols }, (_, i) => (
          <Part key={i} g={G.box(1.05, 1.9, 0.06)} c="#8fd3f5" m={windowMat} position={[(i - (cols - 1) / 2) * 1.5, 1.45, d / 2 + 0.02]} />
        ))}
      </StaticBatch>
    </group>
  );
}

function Crown() {
  const g = useRef<Group>(null);
  const t = useRef(0);
  const h = 0.5 + TOWER_FLOORS * FLOOR_H;
  useFrame((state, dt) => {
    if (g.current) g.current.rotation.y = state.clock.elapsedTime * 0.5;
    t.current += dt;
    if (t.current > 0.35) {
      t.current = 0;
      fx.burst(TOWER.x + (Math.random() - 0.5) * 3, h + 2 + Math.random() * 2, TOWER.z + (Math.random() - 0.5) * 2, "#fff1a8", 2, 1.2, 0.07);
    }
  });
  return (
    <group position={[0, h, 0]}>
      <StaticBatch>
        <Part g={G.box(4.6, 0.8, 3.4)} c="#e9e4d4" position={[0, 0.4, 0]} />
        <Part g={G.cyl(0.1, 0.16, 3.2, 6)} c="#9aa2aa" position={[0, 2.4, 0]} />
      </StaticBatch>
      <group ref={g} position={[0, 4.3, 0]} userData={DYNAMIC}>
        <mesh geometry={G.ico(0.6, 0)}>
          <meshLambertMaterial color="#ffcc33" emissive="#ff9f1c" emissiveIntensity={0.5} flatShading />
        </mesh>
      </group>
    </group>
  );
}
