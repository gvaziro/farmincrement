"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { easeOutBack, easeOutCubic } from "@/game/core/math";
import { PLAYER_STATS, WORKER_STATS, type PlayerStatId, type WorkerStatId } from "@/game/data/balance";
import { CITY_OFFICE } from "@/game/data/city";
import { formatMoney } from "@/game/core/format";
import { ITEMS } from "@/game/data/items";
import { layoutOf } from "@/game/data/worlds";
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
    const show = (id: string, html: string, cls: string, x: number, y: number, z: number) => {
      seen.add(id);
      let el = bubbles.current.get(id);
      if (!el) {
        el = document.createElement("div");
        layer.appendChild(el);
        bubbles.current.set(id, el);
      }
      const key = `${html}|${itemIconsVersion()}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        // Markup is generated locally from item ids and numbers: no user content.
        el.innerHTML = html;
        el.className = `bubble ${cls}`;
      }
      const bob = Math.sin(state.clock.elapsedTime * 3 + x) * 4;
      const s = toScreen(x, y, z);
      el.style.transform = `translate3d(${s.x}px, ${s.y + bob}px, 0) translate(-50%, -100%)`;
      el.style.display = s.behind ? "none" : "";
    };
    // The city: an unattended till, empty counters with someone waiting, money on the table.
    if (st.city) {
      for (const shop of st.city.shops) {
        const d = shop.def;
        const waiting = shop.queue.length > 0 && !shop.cashier && st.player.zoneId !== `till:${shop.id}`;
        if (waiting) show(`till:${shop.id}`, `<span>Касса!</span>`, "bubble--full", d.register.x, 2.0, d.register.z);
        if (shop.bundles > 0 && !shop.collector && st.player.zoneId !== `cash:${shop.id}`) show(`cash:${shop.id}`, `<span>$${formatMoney(Math.floor(shop.cash))}</span>`, "bubble--cash", d.cash.x, 1.5, d.cash.z);
        for (const s of shop.shelves) {
          if (s.count > 0 || !st.city.customers.some((c) => c.shop === shop.id && c.cphase === "pick" && c.want[0] === s.def.item)) continue;
          show(s.id, itemIconHtml(s.def.item, 30), "bubble--need", s.def.box.x, 1.9, s.def.box.z);
        }
      }
    }
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
          // Nothing to harvest in town: the office does not sell reach.
          if (st.world === "city" && id === "reach") return false;
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
        const house = st.city ? null : layoutOf(st).farmhouse;
        const s = house ? toScreen(house.x, 4.6, house.z) : toScreen(CITY_OFFICE.x, 3.6, CITY_OFFICE.z);
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
