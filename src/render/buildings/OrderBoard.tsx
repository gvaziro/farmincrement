"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from "three";
import { formatMoney } from "@/game/core/format";
import { ITEMS } from "@/game/data/items";
import { SEASONS } from "@/game/engine/seasons";
import type { Runtime } from "@/runtime/runtime";
import { fitFont, gameFont, getFontsVersion, outlinedText, roundRect } from "../canvasText";
import { itemIconImage, itemIconsVersion } from "../itemIcons";

const W = 512;
const H = 292;
/** Height of the order part; below it — the seasonal demand strip. */
const ORDER_H = 220;

/** Sign above the market: the current order and the season's demand. */
export function OrderBoard({ runtime, width = 3.6 }: { runtime: Runtime; width?: number }) {
  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
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
    const o = runtime.game.state.order;
    const key = (o ? `${o.id}:${o.fair}:${o.lines.map((l) => l.have).join(",")}` : "none") + runtime.game.state.season;
    const full = `${key}|${itemIconsVersion()}|${getFontsVersion()}`;
    if (full === last.current) return;
    last.current = full;
    draw(canvas.getContext("2d")!, runtime);
    texture.needsUpdate = true;
  });

  return (
    <mesh material={material}>
      <planeGeometry args={[width, (width * H) / W]} />
    </mesh>
  );
}

function draw(ctx: CanvasRenderingContext2D, runtime: Runtime) {
  const o = runtime.game.state.order;
  ctx.clearRect(0, 0, W, H);
  // Wooden frame + paper.
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fillStyle = "#8a5a33";
  ctx.fill();
  roundRect(ctx, 10, 10, W - 20, H - 20, 18);
  ctx.fillStyle = "#fbf1dc";
  ctx.fill();
  // Header.
  roundRect(ctx, 10, 10, W - 20, 58, 18);
  ctx.fillStyle = o?.fair ? "#d9485f" : "#2f7d32";
  ctx.fill();
  ctx.fillRect(10, 48, W - 20, 20);
  const title = o?.fair ? "🎪 ЯРМАРКА · НАГРАДА ×2" : o ? "РЫНОК · ЗАКАЗ" : "РЫНОК";
  outlinedText(ctx, title, W / 2, 41, fitFont(ctx, title, 900, 36, W - 50), "#fff7e0", "rgba(40,10,10,0.6)", 6);
  drawDemand(ctx, runtime);

  if (!o) {
    outlinedText(ctx, "Скоро новый заказ…", W / 2, 140, gameFont(800, 34), "#8a6a3a", "rgba(255,255,255,0)", 0);
    return;
  }

  const n = o.lines.length;
  const slot = (W - 40) / n;
  o.lines.forEach((l, i) => {
    const cx = 20 + slot * (i + 0.5);
    const done = l.have >= l.need;
    const img = itemIconImage(l.item);
    const s = 64;
    if (img) ctx.drawImage(img, cx - s - 10, 84, s, s);
    else {
      ctx.font = gameFont(500, 48);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ITEMS[l.item].icon, cx - s / 2 - 10, 116);
    }
    const text = done ? "✓" : `${l.have}/${l.need}`;
    outlinedText(ctx, text, cx + 34, 118, fitFont(ctx, text, 900, 40, slot - s - 10), done ? "#35c759" : "#3a2a16", "rgba(255,255,255,0.9)", 6);
  });
  const reward = `Награда: +${formatMoney(o.reward)}`;
  outlinedText(ctx, reward, W / 2, 182, fitFont(ctx, reward, 900, 34, W - 60), "#e0a400", "rgba(90,60,0,0.25)", 4);
}

const STRIP = { spring: "#e8679a", summer: "#e0a400", autumn: "#d96a1e", winter: "#4f8fc9" } as const;

/** Bottom strip: what sells for more this season. */
function drawDemand(ctx: CanvasRenderingContext2D, runtime: Runtime) {
  const season = SEASONS[runtime.game.state.season];
  const y = ORDER_H - 6;
  const h = H - 10 - y;
  roundRect(ctx, 10, y, W - 20, h, 18);
  ctx.fillStyle = STRIP[season.id];
  ctx.fill();
  ctx.fillRect(10, y, W - 20, 20);
  ctx.font = gameFont(500, 40);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(season.icon, 52, y + h / 2 + 2);
  outlinedText(ctx, "СПРОС ×1.5", 190, y + h / 2 + 2, gameFont(900, 34), "#ffffff", "rgba(0,0,0,0.3)", 6);
  const s = 52;
  season.demand.forEach((item, i) => {
    const cx = 330 + i * (s + 10);
    const img = itemIconImage(item);
    if (img) ctx.drawImage(img, cx - s / 2, y + h / 2 - s / 2, s, s);
    else {
      ctx.font = gameFont(500, 38);
      ctx.fillText(ITEMS[item].icon, cx, y + h / 2 + 2);
    }
  });
}
