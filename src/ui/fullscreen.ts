/** Fullscreen where the browser allows it (not on iPhones, for example). */
export const canFullscreen = () => typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";

export function toggleFullscreen() {
  if (!canFullscreen()) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void document.documentElement.requestFullscreen().catch(() => {});
}
