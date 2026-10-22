/** Procedural textures (generated once on the client). */
import { CanvasTexture, NoColorSpace, RepeatWrapping } from "three";
import { mulberry32 } from "@/game/core/math";

let grass: CanvasTexture | null = null;

/**
 * Near-white tiling texture with soft blotches and blade strokes. It is
 * multiplied with the plot colour, so it only adds gentle variation.
 */
export function grassTexture() {
  if (grass) return grass;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(42);
  ctx.fillStyle = "rgb(236,236,236)";
  ctx.fillRect(0, 0, S, S);
  // Draws wrap around the edges so the tile is seamless.
  const wrapped = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx > -r && x + dx < S + r && y + dy > -r && y + dy < S + r) draw(x + dx, y + dy);
  };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 30 + rnd() * 90;
    const light = rnd() < 0.5;
    wrapped(x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, light ? "rgba(255,255,255,0.55)" : "rgba(200,205,195,0.45)");
      g.addColorStop(1, "rgba(236,236,236,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  ctx.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 4 + rnd() * 7;
    const a = -Math.PI / 2 + (rnd() - 0.5) * 0.9;
    const shade = rnd() < 0.5;
    wrapped(x, y, 12, (px, py) => {
      ctx.strokeStyle = shade ? "rgba(190,200,185,0.55)" : "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      ctx.stroke();
    });
  }
  grass = new CanvasTexture(c);
  grass.colorSpace = NoColorSpace;
  grass.wrapS = RepeatWrapping;
  grass.wrapT = RepeatWrapping;
  grass.anisotropy = 8;
  return grass;
}

/** Clone of the grass texture with its own repeat (repeat is per texture). */
export function grassTextureRepeat(rx: number, ry: number) {
  const t = grassTexture().clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
