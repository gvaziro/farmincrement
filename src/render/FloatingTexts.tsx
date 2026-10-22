"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { easeOutBack, easeOutCubic } from "@/game/core/math";
import { PLAYER_STATS, WORKER_STATS, type PlayerStatId, type WorkerStatId } from "@/game/data/balance";
import { ITEMS } from "@/game/data/items";
import { FARMHOUSE } from "@/game/data/layout";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { STACK_BASE_Y, stackColumnCount } from "@/game/engine/anchors";
import type { Runtime } from "@/runtime/runtime";
import { fx } from "./fx";
import { itemIconHtml, itemIconsVersion } from "./itemIcons";

const v = new Vector3();

/**
 * DOM overlay projected from 3D: floating "+$12" texts, the МАКС badge over
 * the player and "needs input / full" bubbles over machines.
 */
export function FloatingTexts({ runtime }: { runtime: Runtime }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const layer = useMemo(() => {
    const div = document.createElement("div");
    div.className = "floaters";
    return div;
  }, []);
  const nodes = useRef(new Map<number, HTMLDivElement>());
  const bubbles = useRef(new Map<string, HTMLDivElement>());
  const maxBadge = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parent = gl.domElement.parentElement ?? document.body;
    parent.appendChild(layer);
    const badge = document.createElement("div");
    badge.className = "badge-max";
    badge.textContent = "МАКС";
    layer.appendChild(badge);
    maxBadge.current = badge;
    const textNodes = nodes.current;
    const bubbleNodes = bubbles.current;
    return () => {
      layer.remove();
      textNodes.clear();
      bubbleNodes.clear();
    };
  }, [gl, layer]);

  useFrame((state) => {
    const toScreen = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera);
      return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, behind: v.z > 1 };
    };

    // Floating texts.
    const alive = new Set<number>();
    for (const t of fx.texts) {
      alive.add(t.id);
      let el = nodes.current.get(t.id);
      if (!el) {
        el = document.createElement("div");
        el.className = `floater floater--${t.kind}`;
        el.textContent = t.text;
        layer.appendChild(el);
        nodes.current.set(t.id, el);
      }
      const k = t.t / t.dur;
      const rise = easeOutCubic(Math.min(1, k * 1.4)) * (t.kind === "big" ? 70 : 46);
      const p = toScreen(t.x, t.y, t.z);
      const s = k < 0.18 ? easeOutBack(k / 0.18, 2.4) : 1;
      el.style.opacity = String(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      el.style.transform = `translate3d(${p.x}px, ${p.y - rise}px, 0) translate(-50%, -50%) scale(${s})`;
      el.style.display = p.behind ? "none" : "";
    }
    for (const [id, el] of nodes.current) {
      if (!alive.has(id)) {
        el.remove();
        nodes.current.delete(id);
      }
    }

    const g = runtime.game;
    const st = g.state;

    // МАКС badge above the player's stack.
    const badge = maxBadge.current;
    if (badge) {
      const p = st.player;
      const full = p.stack.length >= p.capacity;
      badge.classList.toggle("badge-max--on", full);
      if (full) {
        const cols = stackColumnCount(p.capacity);
        let h = 0;
        for (let i = 0; i < p.stack.length; i += cols) h += ITEMS[p.stack[i]].height;
        const s = toScreen(p.x, STACK_BASE_Y + h + 0.45, p.z);
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.06;
        badge.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -50%) scale(${pulse})`;
      }
    }

    // Machine bubbles: what is missing / output full.
    const seen = new Set<string>();
    for (const m of st.machines) {
      if (m.spawnT < 1 || m.working) continue;
      let text = "";
      let cls = "";
      if (m.idle === "output") {
        text = `<span>Забери!</span>${itemIconHtml(m.type.output.item, 24)}`;
        cls = "bubble--full";
      } else if (m.idle === "input") {
        const missing = m.type.inputs.filter((i) => (m.inputs[i.item] ?? 0) < i.amount).map((i) => itemIconHtml(i.item, 30));
        if (missing.length === 0) continue;
        text = missing.join("");
        cls = "bubble--need";
      } else continue;
      seen.add(m.id);
      let el = bubbles.current.get(m.id);
      if (!el) {
        el = document.createElement("div");
        layer.appendChild(el);
        bubbles.current.set(m.id, el);
      }
      const key = `${text}|${itemIconsVersion()}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        // Markup is generated locally from item ids — no user content.
        el.innerHTML = text;
        el.className = `bubble ${cls}`;
      }
      const bob = Math.sin(state.clock.elapsedTime * 3 + m.def.x) * 4;
      const s = toScreen(m.def.x, Math.min(m.type.height, 3.8) + 0.5, m.def.z + 0.4);
      el.style.transform = `translate3d(${s.x}px, ${s.y + bob}px, 0) translate(-50%, -100%)`;
      el.style.display = s.behind ? "none" : "";
    }
    // "Upgrade available" over the farmhouse.
    if (st.tutorial >= TUTORIAL_DONE && st.player.zoneId !== "farmhouse") {
      const can =
        (Object.keys(PLAYER_STATS) as PlayerStatId[]).some((id) => {
          const c = g.playerStatCost(id);
          return c !== null && st.money >= c;
        }) ||
        (st.workers.length > 0 &&
          (Object.keys(WORKER_STATS) as WorkerStatId[]).some((id) => {
            const c = g.workerStatCost(id);
            return c !== null && st.money >= c;
          }));
      if (can) {
        seen.add("farmhouse");
        let el = bubbles.current.get("farmhouse");
        if (!el) {
          el = document.createElement("div");
          el.className = "bubble bubble--upgrade";
          el.textContent = "⬆️";
          layer.appendChild(el);
          bubbles.current.set("farmhouse", el);
        }
        const bob = Math.sin(state.clock.elapsedTime * 4) * 5;
        const s = toScreen(FARMHOUSE.x, 4.6, FARMHOUSE.z);
        el.style.transform = `translate3d(${s.x}px, ${s.y + bob}px, 0) translate(-50%, -100%)`;
        el.style.display = s.behind ? "none" : "";
      }
    }

    for (const [id, el] of bubbles.current) {
      if (!seen.has(id)) {
        el.remove();
        bubbles.current.delete(id);
      }
    }
  });

  return null;
}
