/**
 * The app icon (src/app/icon.svg) as PNG, for the manifest and the iPhone
 * home screen. Rendered at build time (the routes are static).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Sky and ground of the icon (icon.svg: the ground starts at 44/64 of the height). */
const SKY = "#8fd36a";
const GROUND = "#6cbf4e";
const GROUND_FROM = 44 / 64;

/**
 * `px` × `px` PNG. `padded` keeps the barn inside the "safe zone" of maskable
 * (Android) and home-screen (iOS) icons, on a full-bleed tile.
 */
export function iconPng(px: number, padded = false) {
  const svg = readFileSync(join(process.cwd(), "src/app/icon.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  const inner = padded ? Math.round(px * 0.74) : px;
  // A padded icon continues the sky and the ground out to the tile's edges.
  const horizon = (((px - inner) / 2 + inner * GROUND_FROM) / px) * 100;
  const tile = padded ? { backgroundImage: `linear-gradient(to bottom, ${SKY} 0%, ${SKY} ${horizon}%, ${GROUND} ${horizon}%, ${GROUND} 100%)` } : {};
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center", ...tile }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page */}
        <img src={src} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
