"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, LinearFilter, MeshBasicMaterial, SRGBColorSpace, type Group } from "three";
import { formatMoney } from "@/game/core/format";
import { easeOutBack } from "@/game/core/math";
import { CROPS } from "@/game/data/crops";
import { fieldById, machineById, type PadKind } from "@/game/data/layout";
import { MACHINE_TYPES } from "@/game/data/machines";
import type { PadState } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { fitFont, gameFont, getFontsVersion, outlinedText, roundRect } from "./canvasText";

const KIND_COLOR: Record<PadKind, string> = {
  build: "#3fa7ff",
  land: "#b06cff",
  hire: "#35c759",
  upgrade: "#ff9f1c",
  special: "#ff5d8f",
};

export function Pads({ runtime }: { runtime: Runtime }) {
  const structure = useUI((s) => s.structure);
  const pads = useMemo(() => {
    void structure;
    return runtime.game.state.pads.filter((p) => p.visible);
  }, [runtime, structure]);
  return (
    <group>
      {pads.map((p) => (
        <Pad key={p.id} runtime={runtime} pad={p} />
      ))}
    </group>
  );
}

const RES = 256;

function Pad({ runtime, pad }: { runtime: Runtime; pad: PadState }) {
  const group = useRef<Group>(null);
  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = RES;
    canvas.height = RES;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.anisotropy = 4;
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    return { canvas, texture, material };
  }, []);
  useEffect(() => () => {
    texture.dispose();
    material.dispose();
  }, [texture, material]);

  const last = useRef("");
  const color = KIND_COLOR[pad.def.kind];

  useFrame((state) => {
    const g = runtime.game;
    const cost = g.padCost(pad) ?? 0;
    const affordable = g.state.money >= cost - pad.paid;
    const progress = cost > 0 ? pad.paid / cost : 0;
    const level = g.padLevel(pad);
    const key = `${Math.round(progress * 60)}|${affordable}|${cost}|${level}|${getFontsVersion()}`;
    if (key !== last.current) {
      last.current = key;
      draw(canvas.getContext("2d")!, pad, color, cost, progress, affordable, level);
      texture.needsUpdate = true;
    }
    const grp = group.current;
    if (!grp) return;
    const appear = Math.min(1, pad.appearT / 0.45);
    const standing = g.state.player.zoneId === `pad:${pad.id}`;
    const pulse = standing ? 1.06 + Math.sin(state.clock.elapsedTime * 10) * 0.025 : 1;
    const s = Math.max(0.001, easeOutBack(appear)) * pulse;
    grp.scale.set(s, 1, s);
  });

  const size = pad.def.size;
  return (
    <group position={[pad.def.x, 0, pad.def.z]}>
      <Ghost pad={pad} />
      <group ref={group}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.07, 0]} material={material} renderOrder={2}>
          <planeGeometry args={[size, size]} />
        </mesh>
      </group>
    </group>
  );
}

function draw(ctx: CanvasRenderingContext2D, pad: PadState, color: string, cost: number, progress: number, affordable: boolean, level: number | null) {
  const W = RES;
  ctx.clearRect(0, 0, W, W);
  const m = 10;
  const r = 34;
  // Base.
  roundRect(ctx, m, m, W - m * 2, W - m * 2, r);
  ctx.fillStyle = "rgba(25, 45, 20, 0.38)";
  ctx.fill();
  // Fill rising with payment.
  if (progress > 0) {
    ctx.save();
    roundRect(ctx, m, m, W - m * 2, W - m * 2, r);
    ctx.clip();
    const h = (W - m * 2) * Math.min(1, progress);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(m, W - m - h, W - m * 2, h);
    ctx.restore();
  }
  // Border.
  roundRect(ctx, m + 4, m + 4, W - m * 2 - 8, W - m * 2 - 8, r - 4);
  ctx.lineWidth = 9;
  ctx.strokeStyle = affordable ? "#ffffff" : "rgba(255,255,255,0.75)";
  ctx.setLineDash(pad.def.kind === "upgrade" ? [] : [26, 14]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Coloured inner ring.
  roundRect(ctx, m + 14, m + 14, W - m * 2 - 28, W - m * 2 - 28, r - 12);
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Icon.
  ctx.font = gameFont(500, 64);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(pad.def.icon, W / 2, 66);

  const label = level !== null ? `${pad.def.label} · ур.${level}` : pad.def.label;
  outlinedText(ctx, label, W / 2, 133, fitFont(ctx, label, 800, 36, W - 44), "#ffffff", "rgba(20,30,15,0.8)", 8);

  const price = `$${formatMoney(Math.max(0, cost - pad.paid))}`;
  outlinedText(ctx, price, W / 2, 192, fitFont(ctx, price, 900, 62, W - 44), affordable ? "#fff7b0" : "#ffd0c8", "rgba(20,30,15,0.85)", 10);
}

/** Dashed outline of what will be built (machines and fields). */
function Ghost({ pad }: { pad: PadState }) {
  const info = useMemo(() => {
    const e = pad.def.effect;
    if (e.type === "machine") {
      const m = machineById(e.id);
      const t = MACHINE_TYPES[m.type];
      return { x: m.x - pad.def.x, z: m.z - pad.def.z, w: t.size[0], d: t.size[1] };
    }
    if (e.type === "field") {
      const f = fieldById(e.id);
      const s = CROPS[f.crop].spacing;
      return { x: 0, z: 0, w: f.cols * s + 0.4, d: f.rows * s + 0.4 };
    }
    return null;
  }, [pad]);

  const material = useMemo(() => {
    if (!info) return null;
    const scale = 48;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(info.w * scale);
    canvas.height = Math.ceil(info.d * scale);
    const ctx = canvas.getContext("2d")!;
    roundRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 18);
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.fill();
    ctx.setLineDash([22, 14]);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  }, [info]);
  useEffect(() => () => {
    material?.map?.dispose();
    material?.dispose();
  }, [material]);

  if (!info || !material) return null;
  return (
    <mesh rotation-x={-Math.PI / 2} position={[info.x, 0.04, info.z]} material={material} renderOrder={1}>
      <planeGeometry args={[info.w, info.d]} />
    </mesh>
  );
}
