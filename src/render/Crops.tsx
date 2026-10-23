"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CircleGeometry, Color, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D } from "three";
import { easeOutBack, easeOutCubic } from "@/game/core/math";
import { TREE_FRUIT_SLOTS, treeYaw, type CropId } from "@/game/data/crops";
import type { Field } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { G, mat } from "./kit";
import { StaticBatch } from "./StaticBatch";
import { cropGeometry, type CropModel } from "./models/cropModels";
import { itemGeometry } from "./models/itemModels";
import { makeSeasonal, seasonVisual } from "./seasonLook";

const vmat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** Orchard crowns blossom in spring and colour in autumn; trunks get snow. */
const canopyMat = makeSeasonal(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), "foliage");
const trunkMat = makeSeasonal(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), "snow");
const dummy = new Object3D();
const tint = new Color();
const GREEN = new Color(0.62, 0.95, 0.5);
const WHITE = new Color(1, 1, 1);
const MAX = 400;

/** Squash-and-stretch scale for a plant from growth and time since last pop. */
function plantScale(growth: number, pop: number, spawn: number) {
  const g = 0.18 + 0.62 * easeOutCubic(Math.min(1, growth));
  let s = growth >= 1 ? 1 : g;
  if (growth >= 1 && pop < 0.5) s *= 0.8 + 0.2 * easeOutBack(pop / 0.5, 3);
  if (spawn < 0.9) s *= easeOutBack(Math.min(1, spawn / 0.9));
  return s;
}

export function Crops({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const fields = useMemo(() => {
    void structure;
    return [...runtime.game.state.fields];
  }, [runtime, structure]);
  return (
    <group>
      {fields
        .filter((f) => f.crop.kind !== "water")
        .map((f) => (
          <Bed key={f.id} field={f} />
        ))}
      <PlantLayer runtime={runtime} crop="wheat" model="wheat" />
      <PlantLayer runtime={runtime} crop="corn" model="corn" />
      <PlantLayer runtime={runtime} crop="grass" model="grass" />
      <PlantLayer runtime={runtime} crop="tomato" model="tomatoBush" />
      <PlantLayer runtime={runtime} crop="flowers" model="flowersPink" variant={[3, 0]} />
      <PlantLayer runtime={runtime} crop="flowers" model="flowersYellow" variant={[3, 1]} />
      <PlantLayer runtime={runtime} crop="flowers" model="flowersPurple" variant={[3, 2]} />
      <PlantLayer runtime={runtime} crop="strawberry" model="strawberryBush" />
      <PlantLayer runtime={runtime} crop="pumpkin" model="pumpkin" />
      <RipeFruits runtime={runtime} crop="tomato" model="tomatoFruits" />
      <RipeFruits runtime={runtime} crop="strawberry" model="strawberryFruits" />
      <Trees runtime={runtime} />
      <FishSpots runtime={runtime} />
    </group>
  );
}

/** Fields only get a light dusting of snow, so they stay easy to see. */
const DUSTING = { kind: "dusting" } as const;

/** Soil bed under a field, with furrows; pops in when bought. */
function Bed({ field }: { field: Field }) {
  const ref = useRef<Object3D>(null);
  const r = field.rect;
  const tree = field.crop.kind === "tree";
  const meadow = field.def.crop === "grass" || field.def.crop === "flowers";
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    const k = field.spawnT < 0.6 ? easeOutBack(Math.min(1, field.spawnT / 0.6)) : 1;
    o.scale.set(k, 1, k);
  });
  const rows = field.def.rows;
  const s = field.crop.spacing;
  return (
    <group ref={ref} position={[r.x, 0, r.z]}>
      <StaticBatch shadow={false}>
      <mesh position={[0, 0.03, 0]} receiveShadow material={mat(tree ? "#6cbf4e" : meadow ? "#64b548" : "#c08a55", DUSTING)}>
        <boxGeometry args={[r.hw * 2 + 0.3, 0.06, r.hd * 2 + 0.3]} />
      </mesh>
      {!tree && (
        <mesh position={[0, 0.05, 0]} receiveShadow material={mat(field.crop.soil, DUSTING)}>
          <boxGeometry args={[r.hw * 2, 0.06, r.hd * 2]} />
        </mesh>
      )}
      {!tree &&
        !meadow &&
        Array.from({ length: rows }, (_, i) => (
          <mesh key={i} position={[0, 0.085, (i - (rows - 1) / 2) * s]} receiveShadow material={mat("#8f5a30", DUSTING)} geometry={G.box(r.hw * 2 - 0.3, 0.02, 0.32)} />
        ))}
      </StaticBatch>
    </group>
  );
}

/**
 * All plants of one crop as one instanced mesh. `variant` = [n, i] keeps only
 * every n-th look (by plant seed), so a crop can mix several models.
 */
function PlantLayer({ runtime, crop, model, variant }: { runtime: Runtime; crop: CropId; model: CropModel; variant?: [number, number] }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => cropGeometry(model), [model]);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    let n = 0;
    for (const f of runtime.game.state.fields) {
      if (f.def.crop !== crop) continue;
      for (const p of f.plants) {
        if (n >= MAX) break;
        if (variant && Math.floor(p.seed * variant[0]) !== variant[1]) continue;
        const s = plantScale(p.growth, p.pop, f.spawnT);
        const sway = p.growth >= 1 ? Math.sin(t * 1.6 + p.seed * 9 + p.x * 0.4) * 0.06 : 0;
        dummy.position.set(p.x, 0.07, p.z);
        dummy.rotation.set(sway, p.seed * 6.28, sway * 0.6);
        dummy.scale.set(s, s * (p.growth >= 1 ? 1 : 0.9), s);
        dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix);
        tint.copy(GREEN).lerp(WHITE, p.growth >= 1 ? 1 : p.growth * 0.6);
        m.setColorAt(n, tint);
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, vmat, MAX]} castShadow receiveShadow frustumCulled={false} />;
}

/** Fruit that only shows on ripe plants (tomatoes, strawberries). */
function RipeFruits({ runtime, crop, model }: { runtime: Runtime; crop: CropId; model: CropModel }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => cropGeometry(model), [model]);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    let n = 0;
    for (const f of runtime.game.state.fields) {
      if (f.def.crop !== crop) continue;
      for (const p of f.plants) {
        if (p.growth < 1) continue;
        const s = plantScale(p.growth, p.pop, f.spawnT);
        dummy.position.set(p.x, 0.07, p.z);
        dummy.rotation.set(0, p.seed * 6.28, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        m.setMatrixAt(n++, dummy.matrix);
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, vmat, MAX]} castShadow frustumCulled={false} />;
}

function Trees({ runtime }: { runtime: Runtime }) {
  const trunks = useRef<InstancedMesh>(null);
  const canopies = useRef<InstancedMesh>(null);
  const apples = useRef<InstancedMesh>(null);
  const geos = useMemo(() => ({ trunk: cropGeometry("treeTrunk"), canopy: cropGeometry("appleCanopy"), apple: cropGeometry("apple") }), []);

  useFrame((state) => {
    const tm = trunks.current;
    const cm = canopies.current;
    const am = apples.current;
    if (!tm || !cm || !am) return;
    const t = state.clock.elapsedTime;
    let n = 0;
    let a = 0;
    for (const f of runtime.game.state.fields) {
      if (f.crop.kind !== "tree") continue;
      for (const p of f.plants) {
        const spawn = f.spawnT < 0.9 ? easeOutBack(Math.min(1, f.spawnT / 0.9)) : 1;
        // Shake when harvested.
        const shake = p.pop < 0.4 && p.fruits < (f.crop.fruits ?? 3) ? Math.sin(p.pop * 50) * 0.05 * (1 - p.pop / 0.4) : 0;
        const yaw = treeYaw(p.seed);
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(shake, yaw, shake);
        dummy.scale.setScalar(spawn);
        dummy.updateMatrix();
        tm.setMatrixAt(n, dummy.matrix);
        cm.setMatrixAt(n, dummy.matrix);
        n++;
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        for (let k = 0; k < p.fruits; k++) {
          const sl = TREE_FRUIT_SLOTS[k];
          const grow = k === p.fruits - 1 && p.pop < 0.4 ? easeOutBack(p.pop / 0.4) : 1;
          dummy.position.set(p.x + (sl[0] * c + sl[2] * sn) * spawn, sl[1] * spawn + Math.sin(t * 2 + k) * 0.02, p.z + (-sl[0] * sn + sl[2] * c) * spawn);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(spawn * grow);
          dummy.updateMatrix();
          am.setMatrixAt(a++, dummy.matrix);
        }
      }
    }
    tm.count = n;
    cm.count = n;
    am.count = a;
    tm.instanceMatrix.needsUpdate = true;
    cm.instanceMatrix.needsUpdate = true;
    am.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={trunks} args={[geos.trunk, trunkMat, 64]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={canopies} args={[geos.canopy, canopyMat, 64]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={apples} args={[geos.apple, vmat, 200]} castShadow frustumCulled={false} />
    </group>
  );
}

const rippleMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
/** Winter: each fishing spot is a hole in the ice. */
const holeGeo = new CircleGeometry(0.62, 14).rotateX(-Math.PI / 2);
const holeMat = new MeshLambertMaterial({ color: "#2f7fa8" });
const LEAP = 0.9;
const LEAP_PERIOD = 2.8;

/** Fishing spots: ripples on the water and a fish leaping now and then. */
function FishSpots({ runtime }: { runtime: Runtime }) {
  const rings = useRef<InstancedMesh>(null);
  const fish = useRef<InstancedMesh>(null);
  const holes = useRef<InstancedMesh>(null);
  const geos = useMemo(() => ({ ring: cropGeometry("ripple"), fish: itemGeometry("fish") }), []);
  useFrame((state) => {
    const rm = rings.current;
    const fm = fish.current;
    const hm = holes.current;
    if (!rm || !fm || !hm) return;
    const t = state.clock.elapsedTime;
    const ice = seasonVisual.winter;
    let r = 0;
    let k = 0;
    let h = 0;
    for (const f of runtime.game.state.fields) {
      if (f.crop.kind !== "water") continue;
      const spawn = f.spawnT < 0.9 ? Math.max(0.001, easeOutBack(Math.min(1, f.spawnT / 0.9))) : 1;
      for (const p of f.plants) {
        if (ice > 0.02) {
          dummy.position.set(p.x, 0.06, p.z);
          dummy.rotation.set(0, p.seed * 6.28, 0);
          dummy.scale.setScalar(ice * spawn);
          dummy.updateMatrix();
          hm.setMatrixAt(h++, dummy.matrix);
        }
        const has = p.fruits > 0;
        // Two expanding rings while fish are biting, a calm one otherwise.
        for (let i = 0; i < (has ? 2 : 1); i++) {
          const cycle = (t * 0.55 + p.seed + i * 0.5) % 1;
          const s = (has ? 0.45 + cycle * 0.9 : 0.55 + Math.sin(t * 1.3 + p.seed * 6) * 0.05) * spawn;
          dummy.position.set(p.x, 0.075, p.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(s, 1, s);
          dummy.updateMatrix();
          rm.setMatrixAt(r++, dummy.matrix);
        }
        if (!has) continue;
        const ph = ((t + p.seed * LEAP_PERIOD) % LEAP_PERIOD) / LEAP;
        if (ph >= 1) continue;
        const yaw = p.seed * Math.PI * 2;
        const along = (ph - 0.5) * 0.7;
        dummy.position.set(p.x + Math.cos(yaw) * along, 0.02 + Math.sin(ph * Math.PI) * 0.6, p.z - Math.sin(yaw) * along);
        dummy.rotation.set(0, yaw, (0.5 - ph) * 2.2);
        dummy.scale.setScalar(0.95 * spawn);
        dummy.updateMatrix();
        fm.setMatrixAt(k++, dummy.matrix);
      }
    }
    rm.count = r;
    fm.count = k;
    hm.count = h;
    rm.instanceMatrix.needsUpdate = true;
    fm.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={holes} args={[holeGeo, holeMat, 40]} frustumCulled={false} receiveShadow />
      <instancedMesh ref={rings} args={[geos.ring, rippleMat, 80]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={fish} args={[geos.fish, vmat, 40]} castShadow frustumCulled={false} />
    </group>
  );
}
