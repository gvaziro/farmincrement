"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace, type Group } from "three";
import { mulberry32 } from "@/game/core/math";
import type { ItemId } from "@/game/data/items";
import { fitFont, gameFont, getFontsVersion, outlinedText, roundRect } from "../canvasText";
import { itemIconImage, useItemIconsVersion } from "../itemIcons";
import { G, Part, Plain, mat } from "../kit";
import { DYNAMIC, StaticBatch } from "../StaticBatch";

// ── canvas decals ───────────────────────────────────────────────────────
export interface DecalSpec {
  icon?: string;
  /** Item whose rendered icon replaces the emoji once available. */
  item?: ItemId;
  text?: string;
  arrow?: "in" | "out";
  color?: string;
  bg?: string;
}

/** Flat canvas-textured plane lying on the ground. */
export function Decal({ w, d, spec, y = 0.06, opacity = 1 }: { w: number; d: number; spec: DecalSpec; y?: number; opacity?: number }) {
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity }), [opacity]);
  const fonts = getFontsVersion();
  const icons = useItemIconsVersion();
  useEffect(() => {
    const scale = 96;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(d * scale);
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    roundRect(ctx, 6, 6, W - 12, H - 12, 22);
    ctx.fillStyle = spec.bg ?? "rgba(255,255,255,0.18)";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = spec.color ?? "rgba(255,255,255,0.85)";
    ctx.setLineDash([20, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
    const img = spec.item ? itemIconImage(spec.item) : undefined;
    if (img) {
      const s = Math.min(W, H) * (spec.text ? 0.5 : 0.68);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, W / 2 - s / 2, (spec.text ? H * 0.4 : H / 2) - s / 2, s, s);
      ctx.globalAlpha = 1;
    } else if (spec.icon) {
      ctx.font = gameFont(500, Math.min(W, H) * (spec.text ? 0.34 : 0.42));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.95;
      ctx.fillText(spec.icon, W / 2, spec.text ? H * 0.4 : H / 2);
      ctx.globalAlpha = 1;
    }
    if (spec.text) {
      outlinedText(ctx, spec.text, W / 2, spec.icon ? H * 0.76 : H / 2, fitFont(ctx, spec.text, 900, Math.min(W, H) * 0.2, W - 30), "#ffffff", "rgba(25,35,20,0.75)", 8);
    }
    if (spec.arrow) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const ax = spec.arrow === "in" ? W - 34 : 34;
      ctx.beginPath();
      if (spec.arrow === "in") {
        ctx.moveTo(ax - 18, 26);
        ctx.lineTo(ax + 6, 26);
        ctx.lineTo(ax - 6, 8);
      } else {
        ctx.moveTo(ax - 6, 26);
        ctx.lineTo(ax + 18, 26);
        ctx.lineTo(ax + 6, 8);
      }
      ctx.closePath();
      ctx.fill();
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    material.map?.dispose();
    material.map = tex;
    material.needsUpdate = true;
  }, [w, d, spec.icon, spec.item, spec.text, spec.arrow, spec.color, spec.bg, material, fonts, icons]);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
  }, [material]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

/** Vertical sign with text (canvas). */
export function Sign({ text, w = 2, h = 0.55, color = "#8a5a33", textColor = "#fff7e0" }: { text: string; w?: number; h?: number; color?: string; textColor?: string }) {
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true }), []);
  const fonts = getFontsVersion();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * 120);
    canvas.height = Math.round(h * 120);
    const ctx = canvas.getContext("2d")!;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 18);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.stroke();
    outlinedText(ctx, text, canvas.width / 2, canvas.height / 2 + 2, fitFont(ctx, text, 900, canvas.height * 0.62, canvas.width - 24), textColor, "rgba(40,20,5,0.55)", 6);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    material.map?.dispose();
    material.map = tex;
    material.needsUpdate = true;
  }, [text, w, h, color, textColor, material, fonts]);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
  }, [material]);
  return (
    <mesh material={material}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

// ── small props ─────────────────────────────────────────────────────────
/** Wooden pallet that items are stacked on. */
export function Pallet({ w = 1.9, d = 1.9 }: { w?: number; d?: number }) {
  const slats = 5;
  return (
    <group>
      {Array.from({ length: slats }, (_, i) => (
        <Part key={i} g={G.box(w, 0.05, (d / slats) * 0.72)} c={i % 2 ? "#c99a62" : "#d6a86f"} position={[0, 0.035, (i - (slats - 1) / 2) * (d / slats)]} />
      ))}
    </group>
  );
}

/** Rectangular low fence (open at the front gap if given). */
export function PenFence({ w, d, gap = 0, color = "#e0b07a" }: { w: number; d: number; gap?: number; color?: string }) {
  const posts = useMemo(() => {
    const pts: [number, number][] = [];
    const step = 0.9;
    const nx = Math.max(1, Math.round(w / step));
    const nz = Math.max(1, Math.round(d / step));
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      pts.push([x, -d / 2]);
      if (Math.abs(x) >= gap / 2) pts.push([x, d / 2]);
    }
    for (let i = 1; i < nz; i++) {
      const z = -d / 2 + (d * i) / nz;
      pts.push([-w / 2, z], [w / 2, z]);
    }
    return pts;
  }, [w, d, gap]);
  const side = (w - gap) / 2;
  return (
    <group>
      {posts.map(([x, z], i) => (
        <Part key={i} g={G.box(0.1, 0.6, 0.1)} c={color} position={[x, 0.3, z]} />
      ))}
      {[0.22, 0.46].map((y) => (
        <group key={y}>
          <Part g={G.box(w, 0.06, 0.05)} c={color} position={[0, y, -d / 2]} />
          <Part g={G.box(0.05, 0.06, d)} c={color} position={[-w / 2, y, 0]} />
          <Part g={G.box(0.05, 0.06, d)} c={color} position={[w / 2, y, 0]} />
          {gap > 0 ? (
            <>
              <Part g={G.box(side, 0.06, 0.05)} c={color} position={[-w / 2 + side / 2, y, d / 2]} />
              <Part g={G.box(side, 0.06, 0.05)} c={color} position={[w / 2 - side / 2, y, d / 2]} />
            </>
          ) : (
            <Part g={G.box(w, 0.06, 0.05)} c={color} position={[0, y, d / 2]} />
          )}
        </group>
      ))}
    </group>
  );
}

// ── animals ─────────────────────────────────────────────────────────────
interface Wanderer {
  x: number;
  z: number;
  tx: number;
  tz: number;
  yaw: number;
  wait: number;
  peck: number;
}

function useWanderers(count: number, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, seed: number, speed: number) {
  const list = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const x = bounds.minX + rnd() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + rnd() * (bounds.maxZ - bounds.minZ);
      return { x, z, tx: x, tz: z, yaw: rnd() * 6.28, wait: rnd() * 2, peck: 0 } as Wanderer;
    });
  }, [count, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, seed]);
  const refs = useRef<(Group | null)[]>([]);
  const heads = useRef<(Group | null)[]>([]);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    list.forEach((w, i) => {
      const dx = w.tx - w.x;
      const dz = w.tz - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        w.wait -= dt;
        w.peck += dt;
        if (w.wait <= 0) {
          w.tx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
          w.tz = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
          w.wait = 1 + Math.random() * 3;
        }
      } else {
        const step = Math.min(d, speed * dt);
        w.x += (dx / d) * step;
        w.z += (dz / d) * step;
        const want = Math.atan2(dx, dz);
        let delta = want - w.yaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        w.yaw += delta * Math.min(1, dt * 6);
        w.peck = 0;
      }
      const g = refs.current[i];
      if (g) {
        g.position.set(w.x, d > 0.05 ? Math.abs(Math.sin(t * 14 + i)) * 0.04 : 0, w.z);
        g.rotation.y = w.yaw;
      }
      const h = heads.current[i];
      if (h) h.rotation.x = d < 0.05 ? Math.max(0, Math.sin(w.peck * 7 + i)) * 0.9 : 0;
    });
  });
  return { list, refs, heads };
}

type HeadRef = (g: Group | null) => void;

/** One chicken; the head is its own group so it can peck. */
export function ChickenModel({ brown = false, headRef }: { brown?: boolean; headRef?: HeadRef }) {
  return (
    <>
      <StaticBatch>
        <Part g={G.sphere(0.2, 8, 6)} c={brown ? "#c98b52" : "#ffffff"} position={[0, 0.27, 0]} scale={[0.9, 0.85, 1.15]} />
        <Part g={G.cone(0.1, 0.22, 5)} c={brown ? "#a8642a" : "#f2f2f2"} position={[0, 0.38, -0.2]} rotation={[-0.9, 0, 0]} />
        <Part g={G.cyl(0.015, 0.015, 0.14, 4)} c="#f29e4c" position={[-0.06, 0.07, 0]} />
        <Part g={G.cyl(0.015, 0.015, 0.14, 4)} c="#f29e4c" position={[0.06, 0.07, 0]} />
      </StaticBatch>
      <group ref={headRef} position={[0, 0.38, 0.16]}>
        <StaticBatch>
          <Part g={G.sphere(0.11, 7, 5)} c={brown ? "#c98b52" : "#ffffff"} position={[0, 0.08, 0.04]} />
          <Part g={G.box(0.04, 0.08, 0.1)} c="#e8413c" position={[0, 0.2, 0.03]} />
          <Part g={G.cone(0.04, 0.09, 4)} c="#f29e4c" position={[0, 0.07, 0.17]} rotation={[Math.PI / 2, 0, 0]} />
          <Part g={G.sphere(0.025, 4, 3)} c="#e8413c" position={[0, 0.0, 0.12]} />
        </StaticBatch>
      </group>
    </>
  );
}

/** One spotted cow. */
export function CowModel({ headRef }: { headRef?: HeadRef }) {
  return (
    <>
      <StaticBatch>
        <Part g={G.box(0.55, 0.5, 0.95)} c="#ffffff" position={[0, 0.75, 0]} />
        <Part g={G.box(0.3, 0.3, 0.02)} c="#2b2b2b" position={[0.28, 0.82, 0.1]} rotation={[0, Math.PI / 2, 0]} />
        <Part g={G.box(0.25, 0.22, 0.02)} c="#2b2b2b" position={[-0.28, 0.75, -0.2]} rotation={[0, Math.PI / 2, 0]} />
        <Part g={G.box(0.3, 0.02, 0.3)} c="#2b2b2b" position={[0.05, 1.005, -0.15]} />
        {[
          [-0.18, -0.32],
          [0.18, -0.32],
          [-0.18, 0.32],
          [0.18, 0.32],
        ].map(([x, z], k) => (
          <Part key={k} g={G.box(0.13, 0.5, 0.13)} c="#f2f2f2" position={[x, 0.25, z]} />
        ))}
        <Part g={G.box(0.05, 0.4, 0.05)} c="#f2f2f2" position={[0, 0.7, -0.5]} rotation={[0.3, 0, 0]} />
        <Part g={G.sphere(0.12, 6, 4)} c="#ffb3c7" position={[0, 0.5, 0.15]} scale={[1, 0.6, 1]} />
      </StaticBatch>
      <group ref={headRef} position={[0, 0.95, 0.5]}>
        <StaticBatch>
          <Part g={G.box(0.36, 0.34, 0.36)} c="#ffffff" position={[0, 0, 0.1]} />
          <Part g={G.box(0.3, 0.18, 0.12)} c="#ffb3c7" position={[0, -0.08, 0.3]} />
          <Part g={G.cone(0.04, 0.16, 4)} c="#f2e3b5" position={[-0.14, 0.22, 0.05]} rotation={[0, 0, 0.5]} />
          <Part g={G.cone(0.04, 0.16, 4)} c="#f2e3b5" position={[0.14, 0.22, 0.05]} rotation={[0, 0, -0.5]} />
          <Part g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[-0.1, 0.06, 0.28]} />
          <Part g={G.sphere(0.03, 4, 3)} c="#2b2b2b" position={[0.1, 0.06, 0.28]} />
          <Part g={G.box(0.14, 0.05, 0.1)} c="#2b2b2b" position={[0.2, 0.08, 0.05]} />
        </StaticBatch>
      </group>
    </>
  );
}

/** One fluffy sheep: a cloud of wool on dark legs, with a dark face. */
export function SheepModel({ headRef }: { headRef?: HeadRef }) {
  return (
    <>
      <StaticBatch>
        <Part g={G.ico(0.32, 1)} c="#fbf8f0" position={[0, 0.55, 0]} scale={[1, 0.85, 1.25]} />
        <Part g={G.ico(0.2, 1)} c="#ffffff" position={[0.16, 0.72, 0.16]} />
        <Part g={G.ico(0.2, 1)} c="#f1ecdf" position={[-0.16, 0.7, -0.14]} />
        <Part g={G.ico(0.18, 1)} c="#ffffff" position={[0.02, 0.77, -0.3]} />
        {[
          [-0.14, -0.2],
          [0.14, -0.2],
          [-0.14, 0.2],
          [0.14, 0.2],
        ].map(([x, z], k) => (
          <Part key={k} g={G.box(0.08, 0.34, 0.08)} c="#3a3a3a" position={[x, 0.17, z]} />
        ))}
      </StaticBatch>
      <group ref={headRef} position={[0, 0.62, 0.38]}>
        <StaticBatch>
          <Part g={G.box(0.2, 0.24, 0.26)} c="#3a3a3a" position={[0, 0, 0.08]} />
          <Part g={G.box(0.14, 0.05, 0.07)} c="#3a3a3a" position={[-0.15, 0.06, 0.02]} rotation={[0, 0, 0.4]} />
          <Part g={G.box(0.14, 0.05, 0.07)} c="#3a3a3a" position={[0.15, 0.06, 0.02]} rotation={[0, 0, -0.4]} />
          <Part g={G.ico(0.12, 1)} c="#ffffff" position={[0, 0.13, 0.02]} />
          <Part g={G.sphere(0.028, 4, 3)} c="#ffffff" position={[-0.06, 0.04, 0.21]} />
          <Part g={G.sphere(0.028, 4, 3)} c="#ffffff" position={[0.06, 0.04, 0.21]} />
        </StaticBatch>
      </group>
    </>
  );
}

type PenBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export function Chickens({ count, bounds, seed }: { count: number; bounds: PenBounds; seed: number }) {
  const { list, refs, heads } = useWanderers(count, bounds, seed, 0.9);
  return (
    <Plain>
      <group userData={DYNAMIC}>
        {list.map((_, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)} scale={0.9}>
            <ChickenModel brown={i % 3 === 2} headRef={(g) => void (heads.current[i] = g)} />
          </group>
        ))}
      </group>
    </Plain>
  );
}

export function Cows({ count, bounds, seed }: { count: number; bounds: PenBounds; seed: number }) {
  const { list, refs, heads } = useWanderers(count, bounds, seed, 0.5);
  return (
    <Plain>
      <group userData={DYNAMIC}>
        {list.map((_, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)}>
            <CowModel headRef={(g) => void (heads.current[i] = g)} />
          </group>
        ))}
      </group>
    </Plain>
  );
}

export function Sheep({ count, bounds, seed }: { count: number; bounds: PenBounds; seed: number }) {
  const { list, refs, heads } = useWanderers(count, bounds, seed, 0.45);
  return (
    <Plain>
      <group userData={DYNAMIC}>
        {list.map((_, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)} scale={i % 3 === 2 ? 0.8 : 1}>
            <SheepModel headRef={(g) => void (heads.current[i] = g)} />
          </group>
        ))}
      </group>
    </Plain>
  );
}

export { mat };
