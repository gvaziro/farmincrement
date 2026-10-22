/** Helpers for drawing UI text into canvas textures with the game font. */

let family: string | null = null;
let fontsVersion = 0;
let listening = false;

export function gameFont(weight: number, px: number) {
  if (!family) {
    const v = typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--font-game").trim() : "";
    family = v || "system-ui, sans-serif";
  }
  return `${weight} ${px}px ${family}, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
}

/** Increments whenever web fonts finish loading — textures redraw on change. */
export function getFontsVersion() {
  if (!listening && typeof document !== "undefined" && document.fonts) {
    listening = true;
    document.fonts.addEventListener("loadingdone", () => fontsVersion++);
    void document.fonts.ready.then(() => fontsVersion++);
  }
  return fontsVersion;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Bold text with a dark outline, centred at (x, y). */
export function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fill = "#ffffff", stroke = "rgba(30,40,20,0.85)", width = 8) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Shrinks the font until the text fits `maxWidth`. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, px: number, maxWidth: number) {
  let size = px;
  ctx.font = gameFont(weight, size);
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = gameFont(weight, size);
  }
  return gameFont(weight, size);
}
