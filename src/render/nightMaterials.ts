/**
 * Materials that react to the night: window glass that lights up, lantern
 * glass, soft light pools on the ground and fireflies. `setNight(k)` is called
 * every frame by the day/night controller with k = 0 (day) … 1 (night).
 */
import { AdditiveBlending, CanvasTexture, Color, MeshBasicMaterial, MeshLambertMaterial, SRGBColorSpace } from "three";

const WARM = new Color("#ffc35a");

/** Window glass: sky-blue by day, warm yellow light at night. */
export const windowMat = new MeshLambertMaterial({ color: "#8fd3f5", emissive: WARM, emissiveIntensity: 0, flatShading: true });

/** Lantern glass on lamp posts. */
export const lanternMat = new MeshLambertMaterial({ color: "#fff3c4", emissive: WARM, emissiveIntensity: 0, flatShading: true });

/** Coloured festive bulbs: a little glow by day, bright at night. */
export const bulbMats = ["#ff4d4d", "#4fd16b", "#4fb3ff", "#ffd23f"].map(
  (c) => new MeshLambertMaterial({ color: c, emissive: new Color(c), emissiveIntensity: 0.3, flatShading: true }),
);

function glowTexture() {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,214,120,0.95)");
  g.addColorStop(0.45, "rgba(255,190,90,0.35)");
  g.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

let glow: MeshBasicMaterial | null = null;
/** Soft additive light pool on the ground under lamps. */
export function glowMat() {
  if (!glow) glow = new MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  return glow;
}

let firefly: MeshBasicMaterial | null = null;
export function fireflyMat() {
  if (!firefly) firefly = new MeshBasicMaterial({ map: glowTexture(), color: "#eaff9a", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  return firefly;
}

let current = -1;

export function setNight(k: number) {
  if (Math.abs(k - current) < 0.002) return;
  current = k;
  // Lights come on a little before full darkness.
  const lit = Math.min(1, Math.max(0, (k - 0.15) / 0.55));
  windowMat.emissiveIntensity = lit * 0.85;
  lanternMat.emissiveIntensity = 0.15 + lit * 1.4;
  for (const b of bulbMats) b.emissiveIntensity = 0.3 + lit * 1.3;
  if (glow) glow.opacity = lit * 0.75;
  if (firefly) firefly.opacity = Math.max(0, (k - 0.5) / 0.5);
}

/** Current night level as last applied (0 … 1). */
export const nightLevel = () => Math.max(0, current);
