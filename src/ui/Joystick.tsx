"use client";

import { useEffect, useRef } from "react";
import type { Game } from "@/game/engine/Game";
import { addZoom, applyInput, input } from "./input";

const RADIUS = 56;

/**
 * Full-screen touch/mouse area: press anywhere and drag to run. The base
 * appears where the finger went down (classic hyper-casual control).
 */
export function Joystick({ game }: { game: Game }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = areaRef.current!;
    const base = baseRef.current!;
    const knob = knobRef.current!;
    let pointer: number | null = null;
    let ox = 0;
    let oy = 0;
    const pinch = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;

    const show = (x: number, y: number) => {
      base.style.transform = `translate(${x}px, ${y}px)`;
      base.classList.add("stick--on");
    };
    const move = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy);
      const k = len > RADIUS ? RADIUS / len : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const mag = Math.min(1, len / RADIUS);
      const dead = len < 6;
      input.stick.x = dead ? 0 : (dx / (len || 1)) * mag;
      input.stick.z = dead ? 0 : (dy / (len || 1)) * mag;
      applyInput(game);
    };
    const end = () => {
      pointer = null;
      input.stick.active = false;
      input.stick.x = 0;
      input.stick.z = 0;
      base.classList.remove("stick--on");
      knob.style.transform = "translate(0px, 0px)";
      applyInput(game);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        end();
        return;
      }
      if (pointer !== null || e.button > 0) return;
      pointer = e.pointerId;
      area.setPointerCapture(e.pointerId);
      ox = e.clientX;
      oy = e.clientY;
      input.stick.active = true;
      show(ox, oy);
      move(0, 0);
    };
    const onMove = (e: PointerEvent) => {
      if (pinch.has(e.pointerId)) {
        pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.size === 2) {
          const [a, b] = [...pinch.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0) addZoom(Math.log(pinchDist / d));
          pinchDist = d;
          return;
        }
      }
      if (e.pointerId !== pointer) return;
      move(e.clientX - ox, e.clientY - oy);
    };
    const onUp = (e: PointerEvent) => {
      pinch.delete(e.pointerId);
      if (e.pointerId === pointer) end();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      addZoom(Math.sign(e.deltaY) * 0.08);
    };

    area.addEventListener("pointerdown", onDown);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerup", onUp);
    area.addEventListener("pointercancel", onUp);
    area.addEventListener("lostpointercapture", onUp);
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      area.removeEventListener("pointerdown", onDown);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerup", onUp);
      area.removeEventListener("pointercancel", onUp);
      area.removeEventListener("lostpointercapture", onUp);
      area.removeEventListener("wheel", onWheel);
    };
  }, [game]);

  return (
    <div ref={areaRef} className="stick-area">
      <div ref={baseRef} className="stick">
        <div ref={knobRef} className="stick__knob" />
      </div>
    </div>
  );
}
