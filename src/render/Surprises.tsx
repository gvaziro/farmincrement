"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AdditiveBlending, CanvasTexture, DoubleSide, MeshBasicMaterial, MeshLambertMaterial, SRGBColorSpace, Vector3, type Group, type Mesh } from "three";
import { easeInOutSine, easeOutBack } from "@/game/core/math";
import { ITEMS, type ItemId } from "@/game/data/items";
import { MERCHANT_CART } from "@/game/data/layout";
import { MERCHANT_MULT } from "@/game/data/surprises";
import { goldenPlant } from "@/game/engine/systems/surprises";
import type { Merchant, RunawayKind } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { edgeArrowEls } from "@/ui/edgeArrows";
import { ChickenModel, CowModel, Decal, SheepModel } from "./buildings/parts";
import { fitFont, gameFont, getFontsVersion, outlinedText, roundRect } from "./canvasText";
import { fx } from "./fx";
import { itemIconImage, itemIconsVersion } from "./itemIcons";
import { G, Part, Plain } from "./kit";
import { itemGeometry } from "./models/itemModels";
import { StaticBatch } from "./StaticBatch";

/** Golden plants, the merchant's cart, runaway animals, the whistle's dust — and the edge arrows. */
export function Surprises({ runtime }: { runtime: Runtime }) {
  return (
    <>
      <GoldenGlow runtime={runtime} />
      <MerchantSpot runtime={runtime} />
      <RunawaySpot runtime={runtime} />
      <WhistleDust runtime={runtime} />
      <EdgeArrows runtime={runtime} />
    </>
  );
}

/** Re-render when something read from the engine changes (checked every frame). */
function useEngineValue<T>(read: () => T): T {
  const [value, setValue] = useState(read);
  const last = useRef(value);
  useFrame(() => {
    const v = read();
    if (v === last.current) return;
    last.current = v;
    setValue(v);
  });
  return value;
}

// ── golden plants ───────────────────────────────────────────────────────
/** Gold at the bottom fading to nothing at the top (additive: black adds nothing). */
function beamTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, "#e0b52c");
  g.addColorStop(0.3, "#6b4c08");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const ringMat = new MeshBasicMaterial({ color: "#ffe680", transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
const starMat = new MeshLambertMaterial({ color: "#ffd23f", emissive: "#b38600", flatShading: true });

/** A pillar of light over the golden plant, a ring round it and a star above, shedding glints. */
function GoldenGlow({ runtime }: { runtime: Runtime }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const star = useRef<Group>(null);
  const glint = useRef(0);
  const beamMat = useMemo(
    () => new MeshBasicMaterial({ map: beamTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    [],
  );
  useEffect(
    () => () => {
      beamMat.map?.dispose();
      beamMat.dispose();
    },
    [beamMat],
  );

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const st = runtime.game.state;
    const gp = goldenPlant(st);
    if (!gp) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const { field, plant } = gp;
    const t = state.clock.elapsedTime;
    const left = st.surprises.golden?.t ?? 0;
    // Blinks while it is about to fade — faster at the very end.
    const blink = left > 10 ? 1 : 0.45 + 0.55 * (Math.sin(t * (left < 4 ? 16 : 8)) > 0 ? 1 : 0);
    const tree = field.crop.kind === "tree";
    g.position.set(plant.x, 0, plant.z);
    g.scale.setScalar(tree ? 1.6 : 1);
    beamMat.opacity = (0.5 + Math.sin(t * 3) * 0.15) * blink;
    ringMat.opacity = 0.85 * blink;
    const r = ring.current!;
    r.rotation.z = t * 1.4;
    r.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    const s = star.current!;
    s.position.y = (tree ? 2.3 : 1.45) + Math.sin(t * 2.6) * 0.14;
    s.rotation.y = t * 2.2;
    glint.current -= dt;
    if (glint.current <= 0) {
      glint.current = 0.08;
      const k = tree ? 1.4 : 0.9;
      fx.sparkle(plant.x + (Math.random() - 0.5) * k, 0.25 + Math.random() * (tree ? 2.4 : 1.1), plant.z + (Math.random() - 0.5) * k);
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh material={beamMat} position={[0, 2.2, 0]} renderOrder={3}>
        <cylinderGeometry args={[0.32, 0.5, 4.4, 16, 1, true]} />
      </mesh>
      <mesh ref={ring} material={ringMat} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.62, 0.8, 28, 1]} />
      </mesh>
      <group ref={star}>
        <mesh material={starMat} castShadow>
          <octahedronGeometry args={[0.2, 0]} />
        </mesh>
      </group>
    </group>
  );
}

// ── the travelling merchant ─────────────────────────────────────────────
/** Every visit gets its own number, so the cart remounts for it. */
const visits = new WeakMap<Merchant, number>();
let visitCount = 0;
const visitKey = (m: Merchant) => {
  let n = visits.get(m);
  if (n === undefined) visits.set(m, (n = ++visitCount));
  return n;
};

/** Mounts the cart while a merchant is visiting. */
function MerchantSpot({ runtime }: { runtime: Runtime }) {
  const merchant = useEngineValue(() => runtime.game.state.surprises.merchant);
  if (!merchant) return null;
  return <MerchantCart key={visitKey(merchant)} m={merchant} />;
}

const itemMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** How far away the cart starts / ends its drive. */
const DRIVE = 7;
const WHEEL_R = 0.42;

function MerchantCart({ m }: { m: Merchant }) {
  const root = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const arm = useRef<Group>(null);
  const decal = useRef<Group>(null);
  const goods = useMemo(() => itemGeometry(m.item), [m.item]);
  const drop = MERCHANT_CART.drop;

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const k = easeInOutSine(Math.max(0, Math.min(1, m.anim)));
    // Rolls in from the east, rolls on to the west.
    const off = (1 - k) * (m.phase === "leave" ? -DRIVE : DRIVE);
    g.position.set(m.x + off, 0, m.z);
    for (const w of wheels.current) if (w) w.rotation.z = off / WHEEL_R;
    const t = state.clock.elapsedTime;
    // He waves while he waits.
    if (arm.current) arm.current.rotation.z = m.phase === "wait" ? 2.3 + Math.sin(t * 7) * 0.45 : 0.25;
    if (decal.current) decal.current.visible = m.phase === "wait";
  });

  return (
    <group>
      <group ref={decal} position={[m.x, 0, m.z + drop.dz]}>
        <Decal w={drop.w} d={drop.d} spec={{ item: m.item, icon: ITEMS[m.item].icon, arrow: "in", color: "#ffd23f" }} />
      </group>
      <group ref={root} position={[m.x + DRIVE, 0, m.z]}>
        <Plain>
          <StaticBatch>
            {/* Cart box with a counter edge. */}
            <Part g={G.box(1.6, 0.5, 1.1)} c="#b5773e" position={[-0.35, 0.72, 0]} />
            <Part g={G.box(1.7, 0.08, 1.2)} c="#8a5a33" position={[-0.35, 0.99, 0]} />
            <Part g={G.box(1.6, 0.12, 0.06)} c="#e8c27a" position={[-0.35, 0.62, 0.56]} />
            {/* Awning posts and a striped canopy, sloping to the front. */}
            {[
              [-1.12, -0.5],
              [0.42, -0.5],
              [-1.12, 0.5],
              [0.42, 0.5],
            ].map(([x, z], i) => (
              <Part key={i} g={G.box(0.07, 1.0, 0.07)} c="#8a5a33" position={[x, 1.5, z]} />
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <Part key={i} g={G.box(0.34, 0.05, 1.36)} c={i % 2 ? "#fff4dc" : "#d9485f"} position={[-1.03 + i * 0.34, 2.02, 0.02]} rotation={[0.22, 0, 0]} />
            ))}
            {/* A barrel and a crate of the goods he is after. */}
            <Part g={G.cyl(0.2, 0.2, 0.42, 10)} c="#a0612f" position={[-0.95, 1.24, -0.28]} />
            <Part g={G.cyl(0.205, 0.205, 0.05, 10)} c="#5a3a1f" position={[-0.95, 1.36, -0.28]} />
            <Part g={G.box(0.5, 0.26, 0.4)} c="#c89456" position={[-0.25, 1.16, -0.22]} />
          </StaticBatch>
          {[-0.62, 0.62].map((z, i) => (
            <group key={z} ref={(g) => void (wheels.current[i] = g)} position={[-0.35, WHEEL_R, z]}>
              <Part g={G.cyl(WHEEL_R, WHEEL_R, 0.09, 12)} c="#6b4a2a" rotation={[Math.PI / 2, 0, 0]} />
              <Part g={G.box(WHEEL_R * 1.8, 0.06, 0.1)} c="#e0b07a" />
              <Part g={G.box(0.06, WHEEL_R * 1.8, 0.1)} c="#e0b07a" />
              <Part g={G.cyl(0.07, 0.07, 0.12, 6)} c="#3a2a1a" rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
          {/* Samples of what he buys, on the counter. */}
          {[-0.85, -0.45, -0.05].map((x, i) => (
            <mesh key={i} geometry={goods} material={itemMat} position={[x, 1.03, 0.32]} rotation={[0, i * 0.7, 0]} scale={0.9} castShadow />
          ))}
          <MerchantMan arm={arm} />
          <group position={[-0.35, 2.95, 0.3]} rotation={[-0.42, 0, 0]}>
            <MerchantSign m={m} />
          </group>
        </Plain>
      </group>
    </group>
  );
}

/** The merchant: a round little man in a feathered hat, standing at the end of his cart. */
function MerchantMan({ arm }: { arm: RefObject<Group | null> }) {
  return (
    <group position={[0.82, 0, 0.1]}>
      <StaticBatch>
        <Part g={G.box(0.12, 0.42, 0.14)} c="#3b4a6b" position={[-0.09, 0.21, 0]} />
        <Part g={G.box(0.12, 0.42, 0.14)} c="#3b4a6b" position={[0.09, 0.21, 0]} />
        <Part g={G.cyl(0.21, 0.25, 0.5, 10)} c="#7b4fa8" position={[0, 0.66, 0]} />
        <Part g={G.cyl(0.255, 0.255, 0.07, 10)} c="#ffd23f" position={[0, 0.5, 0]} />
        <Part g={G.sphere(0.2, 10, 8)} c="#ffcfa0" position={[0, 1.08, 0]} />
        <Part g={G.box(0.2, 0.05, 0.06)} c="#5a3a1f" position={[0, 1.02, 0.18]} />
        <Part g={G.sphere(0.035, 5, 4)} c="#e8917a" position={[0, 1.07, 0.2]} />
        <Part g={G.sphere(0.025, 4, 3)} c="#2b2b2b" position={[-0.07, 1.13, 0.17]} />
        <Part g={G.sphere(0.025, 4, 3)} c="#2b2b2b" position={[0.07, 1.13, 0.17]} />
        <Part g={G.cyl(0.3, 0.3, 0.03, 12)} c="#2f6b3a" position={[0, 1.24, 0]} />
        <Part g={G.cyl(0.15, 0.18, 0.18, 10)} c="#2f6b3a" position={[0, 1.33, 0]} />
        <Part g={G.cone(0.035, 0.32, 4)} c="#e8413c" position={[0.14, 1.42, -0.05]} rotation={[0, 0, -0.6]} />
        <Part g={G.box(0.09, 0.36, 0.09)} c="#7b4fa8" position={[-0.27, 0.68, 0]} rotation={[0, 0, -0.2]} />
      </StaticBatch>
      <group ref={arm} position={[0.24, 0.86, 0]}>
        <Part g={G.box(0.09, 0.36, 0.09)} c="#7b4fa8" position={[0, -0.16, 0]} />
        <Part g={G.sphere(0.055, 5, 4)} c="#ffcfa0" position={[0, -0.36, 0]} />
      </group>
    </group>
  );
}

const SIGN_W = 512;
const SIGN_H = 232;

/** "Покупаю 🧀 3/8 · 1:42 · ×2.5" above the cart. */
function MerchantSign({ m }: { m: Merchant }) {
  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SIGN_W;
    canvas.height = SIGN_H;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new MeshBasicMaterial({ map: texture, transparent: true });
    return { canvas, texture, material };
  }, []);
  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );
  const last = useRef("");
  useFrame(() => {
    const key = `${m.have}|${Math.ceil(m.t)}|${m.phase}|${itemIconsVersion()}|${getFontsVersion()}`;
    if (key === last.current) return;
    last.current = key;
    drawSign(canvas.getContext("2d")!, m);
    texture.needsUpdate = true;
  });
  return (
    <mesh material={material}>
      <planeGeometry args={[2.3, (2.3 * SIGN_H) / SIGN_W]} />
    </mesh>
  );
}

function drawSign(ctx: CanvasRenderingContext2D, m: Merchant) {
  const W = SIGN_W;
  const H = SIGN_H;
  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fillStyle = "#6b3f8f";
  ctx.fill();
  roundRect(ctx, 10, 10, W - 20, H - 20, 18);
  ctx.fillStyle = "#fbf1dc";
  ctx.fill();
  roundRect(ctx, 10, 10, W - 20, 56, 18);
  ctx.fillStyle = "#7b4fa8";
  ctx.fill();
  ctx.fillRect(10, 46, W - 20, 20);
  const done = m.have >= m.need;
  const title = done ? "СПАСИБО!" : m.phase === "leave" ? "ДО ВСТРЕЧИ!" : `ПОКУПАЮ · ЦЕНА ×${MERCHANT_MULT}`;
  outlinedText(ctx, title, W / 2, 40, fitFont(ctx, title, 900, 34, W - 50), "#fff7e0", "rgba(40,10,40,0.6)", 6);
  const img = itemIconImage(m.item);
  const s = 92;
  if (img) ctx.drawImage(img, 36, 82, s, s);
  else drawEmoji(ctx, m.item, 36 + s / 2, 82 + s / 2);
  const count = `${m.have}/${m.need}`;
  outlinedText(ctx, count, 232, 130, fitFont(ctx, count, 900, 62, 190), done ? "#35c759" : "#3a2a16", "rgba(255,255,255,0.9)", 6);
  const secs = Math.max(0, Math.ceil(m.t));
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  outlinedText(ctx, `⏳${time}`, 410, 130, fitFont(ctx, `⏳${time}`, 900, 44, 150), secs <= 20 ? "#d9485f" : "#7b4fa8", "rgba(255,255,255,0.9)", 6);
  // Progress bar.
  roundRect(ctx, 36, 186, W - 72, 22, 11);
  ctx.fillStyle = "#e6d6b8";
  ctx.fill();
  const p = Math.min(1, m.have / m.need);
  if (p > 0) {
    roundRect(ctx, 36, 186, Math.max(22, (W - 72) * p), 22, 11);
    ctx.fillStyle = done ? "#35c759" : "#ffb020";
    ctx.fill();
  }
}

function drawEmoji(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number) {
  ctx.font = gameFont(500, 70);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ITEMS[item].icon, x, y);
}

// ── runaway animals ─────────────────────────────────────────────────────
function RunawaySpot({ runtime }: { runtime: Runtime }) {
  const kind = useEngineValue<RunawayKind | null>(() => runtime.game.state.surprises.runaway?.kind ?? null);
  if (!kind) return null;
  return <RunawayAnimal runtime={runtime} kind={kind} />;
}

function RunawayAnimal({ runtime, kind }: { runtime: Runtime; kind: RunawayKind }) {
  const root = useRef<Group>(null);
  const head = useRef<Group | null>(null);
  const mark = useRef<Group>(null);
  const born = useRef<{ r: object | null; t: number }>({ r: null, t: 0 });
  const puff = useRef(0);
  const setHead = (g: Group | null) => void (head.current = g);

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const st = runtime.game.state;
    const r = st.surprises.runaway;
    if (!r) {
      g.visible = false;
      return;
    }
    // A new escape (even of the same kind) pops in again.
    if (born.current.r !== r) born.current = { r, t: 0 };
    born.current.t += dt;
    g.visible = true;
    const t = state.clock.elapsedTime;
    const speed = Math.hypot(r.vx, r.vz);
    const hop = r.moving ? Math.abs(Math.sin(t * (kind === "chicken" ? 17 : 11))) * (kind === "cow" ? 0.07 : 0.12) : 0;
    g.position.set(r.x, hop, r.z);
    g.rotation.y = r.facing;
    const pop = born.current.t < 0.5 ? easeOutBack(born.current.t / 0.5) : 1;
    g.scale.setScalar(pop * (kind === "chicken" ? 1.15 : 1));
    if (head.current) head.current.rotation.x = r.moving ? Math.sin(t * 13) * 0.18 : Math.max(0, Math.sin(t * 5)) * 0.7;
    // "!" while it is being chased.
    const scared = Math.hypot(st.player.x - r.x, st.player.z - r.z) < 4.5;
    const m = mark.current;
    if (m) {
      m.visible = scared;
      m.position.y = (kind === "cow" ? 1.75 : kind === "sheep" ? 1.35 : 1.0) + Math.abs(Math.sin(t * 9)) * 0.12;
      m.rotation.y = -r.facing;
    }
    puff.current -= dt;
    if (speed > 2 && puff.current <= 0) {
      puff.current = 0.1;
      fx.dust(r.x, r.z);
    }
  });

  return (
    <group ref={root} visible={false}>
      <Plain>
        {kind === "chicken" ? <ChickenModel headRef={setHead} /> : kind === "cow" ? <CowModel headRef={setHead} /> : <SheepModel headRef={setHead} />}
        <group ref={mark} visible={false}>
          <Part g={G.box(0.09, 0.3, 0.09)} c="#e8413c" position={[0, 0.2, 0]} shadow={false} />
          <Part g={G.box(0.09, 0.09, 0.09)} c="#e8413c" position={[0, -0.02, 0]} shadow={false} />
        </group>
      </Plain>
    </group>
  );
}

// ── the foreman's whistle ───────────────────────────────────────────────
/** Running workers kick up dust while the whistle sounds. */
function WhistleDust({ runtime }: { runtime: Runtime }) {
  const timer = useRef(0);
  useFrame((_, dt) => {
    const st = runtime.game.state;
    if (st.surprises.whistle <= 0) return;
    timer.current -= dt;
    if (timer.current > 0) return;
    timer.current = 0.08;
    let n = 0;
    for (const w of st.workers) {
      if (!w.moving || Math.random() > 0.35) continue;
      fx.dust(w.x - Math.sin(w.facing) * 0.25, w.z - Math.cos(w.facing) * 0.25);
      if (++n >= 10) break;
    }
  });
  return null;
}

// ── arrows at the screen edge ───────────────────────────────────────────
const tmp = new Vector3();
/** Keep the arrows clear of the top bar and the bottom buttons. */
const INSET = { left: 46, right: 46, top: 156, bottom: 118 };

/**
 * Off-screen surprises get an arrow at the edge of the screen. The arrows are
 * DOM elements of the HUD; this only moves them, every frame.
 */
function EdgeArrows({ runtime }: { runtime: Runtime }) {
  useFrame(({ camera, size }) => {
    const st = runtime.game.state;
    const targets = runtime.game.surpriseTargets();
    for (const [kind, el] of edgeArrowEls) {
      const target = targets.find((t) => t.kind === kind);
      if (!target) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      tmp.set(target.x, 0.8, target.z).project(camera);
      const sx = ((tmp.x + 1) / 2) * size.width;
      const sy = ((1 - tmp.y) / 2) * size.height;
      const minX = INSET.left;
      const maxX = size.width - INSET.right;
      const minY = INSET.top;
      const maxY = size.height - INSET.bottom;
      const onScreen = tmp.z < 1 && sx > minX && sx < maxX && sy > minY && sy < maxY;
      if (onScreen) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      // Along the ray from the screen centre to the target, up to the inset frame.
      const cx = size.width / 2;
      const cy = (minY + maxY) / 2;
      let dx = sx - cx;
      let dy = sy - cy;
      if (tmp.z >= 1) {
        dx = -dx;
        dy = -dy;
      }
      const kx = dx > 0 ? (maxX - cx) / dx : dx < 0 ? (minX - cx) / dx : Infinity;
      const ky = dy > 0 ? (maxY - cy) / dy : dy < 0 ? (minY - cy) / dy : Infinity;
      const k = Math.min(kx, ky);
      const x = cx + dx * k;
      const y = cy + dy * k;
      el.style.display = "flex";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.setProperty("--angle", `${Math.atan2(dy, dx).toFixed(3)}rad`);
      const dist = `${Math.round(Math.hypot(target.x - st.player.x, target.z - st.player.z))} м`;
      const label = el.querySelector<HTMLElement>(".edge-arrow__dist");
      if (label && label.textContent !== dist) label.textContent = dist;
      const icon = el.querySelector<HTMLElement>(".edge-arrow__icon");
      if (icon && icon.textContent !== target.icon) icon.textContent = target.icon;
    }
  });
  return null;
}
