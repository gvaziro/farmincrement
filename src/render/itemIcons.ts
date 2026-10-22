/**
 * Item icons rendered from the actual 3D item models, once, in a throwaway
 * WebGL context. Used by bubbles, pallet decals and the HUD so icons always
 * match what the player carries.
 */
import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  NoToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { useSyncExternalStore } from "react";
import { ITEM_IDS, ITEMS, type ItemId } from "@/game/data/items";
import { itemGeometry } from "./models/itemModels";

const urls = new Map<ItemId, string>();
const images = new Map<ItemId, HTMLImageElement>();
let version = 0;
let started = false;
const listeners = new Set<() => void>();

export function itemIconsVersion() {
  return version;
}

export function onItemIcons(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Data URL of the item icon, if rendered. */
export function itemIconUrl(id: ItemId) {
  return urls.get(id);
}

/** Loaded image of the item icon (for canvas drawing), if ready. */
export function itemIconImage(id: ItemId) {
  const img = images.get(id);
  return img && img.complete && img.naturalWidth > 0 ? img : undefined;
}

/** `<img>` markup for DOM labels, with emoji fallback. */
export function itemIconHtml(id: ItemId, size = 30) {
  const url = urls.get(id);
  return url ? `<img src="${url}" width="${size}" height="${size}" alt="${ITEMS[id].name}" draggable="false" />` : ITEMS[id].icon;
}

export function renderItemIcons() {
  if (started || typeof document === "undefined") return;
  started = true;
  const size = 128;
  let renderer: WebGLRenderer | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    scene.add(new HemisphereLight("#ffffff", "#b5c99a", 2.2));
    const sun = new DirectionalLight("#fff4e0", 2.6);
    sun.position.set(-2, 4, 3);
    scene.add(sun);
    const camera = new PerspectiveCamera(28, 1, 0.05, 20);
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const box = new Box3();
    const center = new Vector3();
    const dims = new Vector3();

    for (const id of ITEM_IDS) {
      const mesh = new Mesh(itemGeometry(id), material);
      // Three-quarter view, slightly from above.
      mesh.rotation.set(0.35, -0.65, 0.12);
      mesh.updateMatrixWorld();
      box.setFromObject(mesh);
      box.getCenter(center);
      box.getSize(dims);
      const radius = Math.max(dims.x, dims.y, dims.z) * 0.62;
      const dist = radius / Math.tan((camera.fov * Math.PI) / 360);
      camera.position.set(center.x, center.y + dist * 0.12, center.z + dist);
      camera.lookAt(center);
      scene.add(mesh);
      renderer.render(scene, camera);
      scene.remove(mesh);
      const url = canvas.toDataURL("image/png");
      urls.set(id, url);
      const img = new Image();
      img.onload = () => {
        version++;
        for (const fn of listeners) fn();
      };
      img.src = url;
      images.set(id, img);
    }
    material.dispose();
  } catch (err) {
    console.warn("Item icons could not be rendered, using emoji", err);
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  version++;
  for (const fn of listeners) fn();
}

/** React hook: re-renders when icons finish rendering/loading. */
export function useItemIconsVersion() {
  return useSyncExternalStore(onItemIcons, itemIconsVersion, () => 0);
}
