import { iconPng } from "@/pwa/iconImage";

/** iPhone home-screen icon (iOS rounds the corners itself, so it fills the tile). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return iconPng(180, true);
}
